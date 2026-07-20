'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  createTempDir,
  removeDirRecursive,
  segmentVideo,
  extractSegmentFrames,
  extractPosterFrame,
  readFramesAsBase64,
  ensureFfmpegAvailable,
  setFfmpegPath,
  MAX_SEGMENTS
} = require('./ffmpeg-utils');
const { getFfmpegPath, ensureSegmentsDirForClip, ensureThumbnailPathForClip, getYtdlpPath, originalsDir } = require('./config');
const { reviewSegment } = require('./ollama-client');
const {
  shouldStopAssessing,
  mergeSegmentRatings,
  computeOverallScore,
  buildSummary
} = require('./analyzer');
const { logAuditEvent } = require('./audit-logger');
const { reconcilePlayerClipStats } = require('./reconcile-player-clip-stats');
const { syncPlayerSkillRatingsFromClip } = require('./sync-player-skill-ratings-from-clip');
const {
  downloadSourceVideo,
  probeDurationSeconds,
  extractWindowMaxFps,
  MAX_DURATION_SEC
} = require('./link-ingest');
const { findPlayerInVideo } = require('./find-player');

const MAX_AI_FPS = 30;

function computeAge(birthMonth, birthYear) {
  if (!birthYear) {
    return 'unknown';
  }
  const now = new Date();
  const month = birthMonth ? Number(birthMonth) : 1;
  let age = now.getFullYear() - Number(birthYear);
  if (now.getMonth() + 1 < month) {
    age -= 1;
  }
  return age;
}

async function loadClipContext(pool, clipId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.video_storage_path AS "videoStoragePath",
        c.skill_focus AS "skillFocus",
        c.source_url AS "sourceUrl",
        c.source_start_ms AS "sourceStartMs",
        c.source_duration_ms AS "sourceDurationMs",
        c.find_player AS "findPlayer",
        c.find_player_matched_ms AS "findPlayerMatchedMs",
        p.name AS "playerName",
        p.position AS "position",
        p.birth_month AS "birthMonth",
        p.birth_year AS "birthYear",
        p.player_avatar_url AS "avatarUrl",
        COALESCE(s.name, 'Unknown Sport') AS "sportType"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      LEFT JOIN sports s ON s.id = t.sport_id
      WHERE c.id = $1
      LIMIT 1
    `,
    [clipId]
  );
  return result.rows[0] || null;
}

async function markClipFailed(pool, clipId, message) {
  const errorText = String(message || 'Video processing failed');
  await pool.query(
    `
      UPDATE clips
      SET status = 'failed',
          error_message = $2,
          comments = $2,
          processing_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [clipId, errorText]
  );
}

async function markClipComplete(pool, clipId, { skillRatings, score, summary, comments }) {
  await pool.query(
    `
      UPDATE clips
      SET status = 'complete',
          skill_ratings = $2::jsonb,
          score = $3,
          summary = $4,
          comments = $5,
          processing_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [clipId, JSON.stringify(skillRatings || {}), score, summary || '', comments || '']
  );
}

async function clearClipSegments(pool, clipId) {
  await pool.query(`DELETE FROM clip_segments WHERE clip_id = $1`, [clipId]);
  const durableDir = ensureSegmentsDirForClip(clipId);
  if (fs.existsSync(durableDir)) {
    fs.readdirSync(durableDir).forEach((name) => {
      fs.unlinkSync(path.join(durableDir, name));
    });
  }
}

async function saveClipSegment(pool, clipId, segmentIndex, segmentPath) {
  const id = `${clipId}_seg_${segmentIndex}`;
  await pool.query(
    `
      INSERT INTO clip_segments (id, clip_id, segment_index, path)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (clip_id, segment_index)
      DO UPDATE SET path = EXCLUDED.path
    `,
    [id, clipId, segmentIndex, segmentPath]
  );
}

/**
 * Link clips: download → extract Start+Duration at ≤30fps → optional Find player
 * inside that extract → assessment working file.
 * Reprocess with an existing on-disk path reuses it (assess-only; no download/extract).
 */
async function prepareLinkSourceIfNeeded(pool, clip, framesDir) {
  if (!clip.sourceUrl) {
    return clip.videoStoragePath;
  }

  if (clip.videoStoragePath && fs.existsSync(clip.videoStoragePath)) {
    logAuditEvent('clip.link.reuse_existing', {
      clipId: clip.id,
      path: clip.videoStoragePath
    });
    return clip.videoStoragePath;
  }

  const startSec = Math.max(0, Math.floor((Number(clip.sourceStartMs) || 0) / 1000));
  const durationSec = Math.max(1, Math.floor((Number(clip.sourceDurationMs) || 60000) / 1000));
  const ytdlpPath = await getYtdlpPath(pool);

  const sourcePath = await downloadSourceVideo({
    url: clip.sourceUrl,
    clipId: clip.id,
    ytdlpPath
  });

  const mediaDuration = await probeDurationSeconds(sourcePath);
  if (startSec >= mediaDuration) {
    throw new Error('Start time is beyond the end of the downloaded video.');
  }
  const availableFromStart = mediaDuration - startSec;
  if (availableFromStart < durationSec) {
    throw new Error(
      `Not enough video remains after start to fulfill duration ${durationSec}s (only ${Math.max(0, Math.floor(availableFromStart))}s left).`
    );
  }

  const windowPath = path.join(originalsDir(), `${clip.id}_window.mp4`);
  const windowResult = await extractWindowMaxFps(
    sourcePath,
    windowPath,
    startSec,
    durationSec,
    MAX_AI_FPS
  );
  logAuditEvent('clip.link.window.ready', {
    clipId: clip.id,
    sourcePath,
    windowPath,
    startSec,
    durationSec,
    sourceFps: windowResult.sourceFps,
    appliedFpsCap: windowResult.appliedFpsCap
  });

  let workingPath = windowPath;
  let extractStartSec = startSec;

  if (clip.findPlayer) {
    if (!clip.avatarUrl) {
      throw new Error('Find player requires the selected player to have a photo assigned.');
    }
    const windowDuration = await probeDurationSeconds(windowPath);
    const matchedOffsetSec = await findPlayerInVideo(pool, {
      clipId: clip.id,
      videoPath: windowPath,
      startSec: 0,
      mediaEndSec: windowDuration,
      avatarUrl: clip.avatarUrl,
      framesDir,
      fetchBaseUrl: process.env.MOCKUP_PUBLIC_BASE_URL || 'http://127.0.0.1:4173'
    });
    if (matchedOffsetSec == null) {
      throw new Error('Player was not found in the video after the requested start time.');
    }

    const absoluteMatchedSec = startSec + matchedOffsetSec;
    extractStartSec = absoluteMatchedSec;
    await pool.query(
      `
        UPDATE clips
        SET find_player_matched_ms = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [clip.id, Math.round(absoluteMatchedSec * 1000)]
    );

    const remainingInWindow = windowDuration - matchedOffsetSec;
    if (remainingInWindow < 1) {
      throw new Error('Not enough video remains after the player was found to extract a clip.');
    }
    const assessDuration = Math.min(durationSec, remainingInWindow);
    const matchedPath = path.join(originalsDir(), `${clip.id}_extract.mp4`);
    await extractWindowMaxFps(
      windowPath,
      matchedPath,
      matchedOffsetSec,
      assessDuration,
      MAX_AI_FPS
    );
    workingPath = matchedPath;
  } else {
    // Assessment uses the Start+Duration window as-is (already ≤30 fps).
    const extractPath = path.join(originalsDir(), `${clip.id}_extract.mp4`);
    if (extractPath !== windowPath) {
      fs.copyFileSync(windowPath, extractPath);
      workingPath = extractPath;
    }
  }

  await pool.query(
    `
      UPDATE clips
      SET video_storage_path = $2,
          original_filename = COALESCE(original_filename, 'link-extract.mp4'),
          file_size_bytes = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [clip.id, workingPath, fs.statSync(workingPath).size]
  );
  logAuditEvent('clip.link.extract.ready', {
    clipId: clip.id,
    sourcePath,
    workingPath,
    extractStartSec,
    durationSec,
    findPlayer: Boolean(clip.findPlayer)
  });
  return workingPath;
}

/**
 * Upload clips: trim to start+duration (≤30s), normalize to ≤30 fps, then AI segment.
 */
async function prepareUploadNormalizeIfNeeded(pool, clip) {
  if (clip.sourceUrl || !clip.videoStoragePath) {
    return clip.videoStoragePath;
  }
  const inputPath = clip.videoStoragePath;
  if (!fs.existsSync(inputPath)) {
    throw new Error('No video file is attached to this clip.');
  }
  if (/_extract\.mp4$/i.test(inputPath) || /_window\.mp4$/i.test(inputPath)) {
    return inputPath;
  }

  const startSec = Math.max(0, Number(clip.sourceStartMs || 0) / 1000);
  let durationSec = clip.sourceDurationMs != null
    ? Number(clip.sourceDurationMs) / 1000
    : MAX_DURATION_SEC;
  if (!Number.isFinite(durationSec) || durationSec < 1) {
    throw new Error('Clip is missing a valid analysis duration (start/duration window).');
  }
  durationSec = Math.min(durationSec, MAX_DURATION_SEC);

  const mediaDuration = await probeDurationSeconds(inputPath);
  if (startSec >= mediaDuration) {
    throw new Error('Start time is beyond the end of the uploaded video.');
  }
  const availableFromStart = mediaDuration - startSec;
  if (availableFromStart < 1) {
    throw new Error('Not enough video remains after the requested start time.');
  }
  const windowDuration = Math.min(durationSec, availableFromStart);

  const extractPath = path.join(originalsDir(), `${clip.id}_extract.mp4`);
  const result = await extractWindowMaxFps(
    inputPath,
    extractPath,
    startSec,
    windowDuration,
    MAX_AI_FPS
  );
  await pool.query(
    `
      UPDATE clips
      SET video_storage_path = $2,
          file_size_bytes = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [clip.id, extractPath, fs.statSync(extractPath).size]
  );
  logAuditEvent('clip.upload.window.ready', {
    clipId: clip.id,
    inputPath,
    extractPath,
    startSec,
    durationSec: windowDuration,
    sourceFps: result.sourceFps,
    appliedFpsCap: result.appliedFpsCap
  });
  return extractPath;
}

async function processClip(pool, clipId) {
  const clip = await loadClipContext(pool, clipId);
  if (!clip) {
    return;
  }
  if (clip.status !== 'in_progress') {
    return;
  }

  const skillFocusList = Array.isArray(clip.skillFocus) && clip.skillFocus.length
    ? clip.skillFocus
    : ['General'];
  logAuditEvent('clip.processing.started', {
    clipId,
    playerName: clip.playerName,
    sportType: clip.sportType,
    position: clip.position,
    ageOfPlayer: computeAge(clip.birthMonth, clip.birthYear),
    situation: clip.situation,
    skillFocusCount: skillFocusList.length,
    path: clip.videoStoragePath,
    sourceUrl: clip.sourceUrl || null
  });
  const assessmentContext = {
    sportType: clip.sportType,
    situation: clip.situation,
    ageOfPlayer: computeAge(clip.birthMonth, clip.birthYear),
    skillFocusList
  };

  const tempRoot = createTempDir('vantageiq-clip-');
  const framesDir = path.join(tempRoot, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const durableSegmentsDir = ensureSegmentsDirForClip(clipId);
  let ratingsBySkill = {};
  let lastComments = '';

  try {
    setFfmpegPath(await getFfmpegPath(pool));
    await ensureFfmpegAvailable();

    let videoPath = clip.videoStoragePath;
    if (clip.sourceUrl) {
      videoPath = await prepareLinkSourceIfNeeded(pool, clip, framesDir);
    } else {
      videoPath = await prepareUploadNormalizeIfNeeded(pool, clip);
    }
    if (!videoPath) {
      logAuditEvent('clip.processing.no_video', { clipId });
      await markClipFailed(pool, clipId, 'No video file is attached to this clip.');
      logAuditEvent('clip.failed', { clipId, error: 'No video file is attached to this clip.' });
      await reconcilePlayerClipStats(pool, clip.playerId);
      return;
    }

    await clearClipSegments(pool, clipId);
    const allSegmentPaths = await segmentVideo(videoPath, durableSegmentsDir);
    const segmentPaths = allSegmentPaths.slice(0, MAX_SEGMENTS);
    for (const extraPath of allSegmentPaths.slice(MAX_SEGMENTS)) {
      try {
        fs.unlinkSync(extraPath);
      } catch (unlinkError) {
        // Best-effort cleanup of surplus segments beyond the analysis cap.
      }
    }

    for (let index = 0; index < segmentPaths.length; index += 1) {
      const segmentPath = segmentPaths[index];
      await saveClipSegment(pool, clipId, index, segmentPath);
      const framePaths = await extractSegmentFrames(segmentPath, framesDir);
      const frameImages = readFramesAsBase64(framePaths);
      const segmentResult = await reviewSegment(pool, assessmentContext, frameImages);
      ratingsBySkill = mergeSegmentRatings(ratingsBySkill, segmentResult.ratings);
      if (segmentResult.comments) {
        lastComments = segmentResult.comments;
      }

      const earlyStop = shouldStopAssessing(skillFocusList, ratingsBySkill, index);
      logAuditEvent('clip.segment.assessed', {
        clipId,
        segmentIndex: index,
        ratedSkillCount: Object.keys(ratingsBySkill).length,
        earlyStop,
        path: segmentPath
      });

      if (earlyStop) {
        break;
      }
    }

    const score = computeOverallScore(ratingsBySkill);
    const summary = buildSummary(ratingsBySkill, lastComments);
    try {
      const posterSource = segmentPaths[0] || videoPath;
      if (posterSource) {
        const thumbPath = ensureThumbnailPathForClip(clipId);
        await extractPosterFrame(posterSource, thumbPath);
        logAuditEvent('clip.thumbnail.written', { clipId, path: thumbPath });
      }
    } catch (thumbError) {
      console.error(`Clip ${clipId} thumbnail generation failed:`, thumbError);
      logAuditEvent('clip.thumbnail.error', {
        clipId,
        error: thumbError.message || String(thumbError)
      });
    }
    await markClipComplete(pool, clipId, {
      skillRatings: ratingsBySkill,
      score,
      summary,
      comments: lastComments
    });
    logAuditEvent('clip.complete', {
      clipId,
      score,
      ratedSkillCount: Object.keys(ratingsBySkill).length
    });
    try {
      await syncPlayerSkillRatingsFromClip(pool, {
        playerId: clip.playerId,
        skillRatings: ratingsBySkill,
        clipId
      });
    } catch (syncError) {
      console.error(`Clip ${clipId} skill rating sync failed:`, syncError);
      logAuditEvent('player.skill_ratings.sync.error', {
        clipId,
        playerId: clip.playerId,
        error: syncError.message || String(syncError)
      });
    }
  } catch (error) {
    console.error(`Clip ${clipId} processing failed:`, error);
    const errorMessage = error.message || String(error);
    await markClipFailed(pool, clipId, errorMessage);
    logAuditEvent('clip.failed', { clipId, error: errorMessage });
  } finally {
    await reconcilePlayerClipStats(pool, clip.playerId);
    removeDirRecursive(tempRoot);
  }
}

module.exports = {
  loadClipContext,
  processClip,
  markClipFailed,
  saveClipSegment,
  clearClipSegments,
  prepareLinkSourceIfNeeded,
  prepareUploadNormalizeIfNeeded
};
