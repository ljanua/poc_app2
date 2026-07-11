'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  createTempDir,
  removeDirRecursive,
  segmentVideo,
  extractSegmentFrames,
  readFramesAsBase64,
  ensureFfmpegAvailable,
  setFfmpegPath
} = require('./ffmpeg-utils');
const { getFfmpegPath, ensureSegmentsDirForClip } = require('./config');
const { reviewSegment } = require('./ollama-client');
const {
  shouldStopAssessing,
  mergeSegmentRatings,
  computeOverallScore,
  buildSummary
} = require('./analyzer');
const { logAuditEvent } = require('./audit-logger');
const { reconcilePlayerClipStats } = require('./reconcile-player-clip-stats');

function computeAge(birthMonth, birthYear) {
  if (!birthMonth || !birthYear) {
    return 'unknown';
  }
  const now = new Date();
  let age = now.getFullYear() - Number(birthYear);
  if (now.getMonth() + 1 < Number(birthMonth)) {
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
        p.name AS "playerName",
        p.position AS "position",
        p.birth_month AS "birthMonth",
        p.birth_year AS "birthYear",
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

async function processClip(pool, clipId) {
  const clip = await loadClipContext(pool, clipId);
  if (!clip) {
    return;
  }
  if (clip.status !== 'in_progress') {
    return;
  }
  if (!clip.videoStoragePath) {
    logAuditEvent('clip.processing.no_video', { clipId });
    await markClipFailed(pool, clipId, 'No video file is attached to this clip.');
    logAuditEvent('clip.failed', { clipId, error: 'No video file is attached to this clip.' });
    await reconcilePlayerClipStats(pool, clip.playerId);
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
    path: clip.videoStoragePath
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
    await clearClipSegments(pool, clipId);
    setFfmpegPath(await getFfmpegPath(pool));
    await ensureFfmpegAvailable();
    const segmentPaths = await segmentVideo(clip.videoStoragePath, durableSegmentsDir);

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
  clearClipSegments
};
