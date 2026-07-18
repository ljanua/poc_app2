'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { readMultipartForm, parseSkillFocusField } = require('./read-multipart');
const { triggerVideoProcessing } = require('./queue');
const { logAuditEvent } = require('./audit-logger');
const { reconcilePlayerClipStats } = require('./reconcile-player-clip-stats');
const { ensureOriginalsDir, originalsDir } = require('./config');
const {
  parseMmSs,
  resolveDurationSeconds,
  MAX_DURATION_SEC,
  DEFAULT_DURATION_SEC
} = require('./link-ingest');

function sanitizeFilename(filename) {
  return String(filename || 'clip.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function parseBooleanField(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function listSegmentsForClips(pool, clipIds) {
  if (!pool || !clipIds || !clipIds.length) {
    return new Map();
  }
  const result = await pool.query(
    `
      SELECT clip_id AS "clipId", segment_index AS "index", path
      FROM clip_segments
      WHERE clip_id = ANY($1::text[])
      ORDER BY clip_id ASC, segment_index ASC
    `,
    [clipIds]
  );
  const byClip = new Map();
  result.rows.forEach((row) => {
    const list = byClip.get(row.clipId) || [];
    list.push({ index: row.index, path: row.path });
    byClip.set(row.clipId, list);
  });
  return byClip;
}

function toClipResponse(row, segments) {
  const pathValue = row.path || row.videoStoragePath || null;
  return {
    id: row.id,
    playerId: row.playerId,
    playerName: row.playerName,
    teamName: row.teamName,
    situation: row.situation,
    status: row.status,
    score: row.score,
    summary: row.summary,
    comments: row.comments || null,
    submittedAt: row.submittedAt,
    skill: row.skill,
    skillFocus: row.skillFocus || [],
    skillRatings: row.skillRatings || null,
    errorMessage: row.errorMessage || null,
    path: pathValue,
    sourceUrl: row.sourceUrl || null,
    sourceStartMs: row.sourceStartMs != null ? row.sourceStartMs : null,
    sourceDurationMs: row.sourceDurationMs != null ? row.sourceDurationMs : null,
    findPlayer: Boolean(row.findPlayer),
    findPlayerMatchedMs: row.findPlayerMatchedMs != null ? row.findPlayerMatchedMs : null,
    segments: Array.isArray(segments) ? segments : []
  };
}

async function selectClipById(pool, clipId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.player_id AS "playerId",
        c.situation,
        c.status,
        c.score,
        c.summary,
        c.comments,
        c.submitted_at_label AS "submittedAt",
        c.skill,
        c.skill_focus AS "skillFocus",
        c.skill_ratings AS "skillRatings",
        c.error_message AS "errorMessage",
        c.video_storage_path AS "videoStoragePath",
        c.video_storage_path AS "path",
        c.source_url AS "sourceUrl",
        c.source_start_ms AS "sourceStartMs",
        c.source_duration_ms AS "sourceDurationMs",
        c.find_player AS "findPlayer",
        c.find_player_matched_ms AS "findPlayerMatchedMs",
        p.name AS "playerName",
        t.name AS "teamName"
      FROM clips c
      JOIN players p ON p.id = c.player_id
      LEFT JOIN player_team_assignments a ON a.player_id = p.id
      LEFT JOIN teams t ON t.id = a.team_id
      WHERE c.id = $1
      LIMIT 1
    `,
    [clipId]
  );
  return result.rows[0] || null;
}

async function resolvePlayerId(pool, playerId, playerName, helpers) {
  let resolvedPlayerId = playerId;
  if (!resolvedPlayerId && playerName) {
    const player = await pool.query(
      `SELECT id FROM players WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [playerName]
    );
    if (!player.rows[0]) {
      return {
        error: { status: 404, body: helpers.appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.') }
      };
    }
    resolvedPlayerId = player.rows[0].id;
  }
  return { resolvedPlayerId };
}

async function loadPlayerAvatar(pool, playerId) {
  const result = await pool.query(
    `SELECT player_avatar_url AS "avatarUrl" FROM players WHERE id = $1 LIMIT 1`,
    [playerId]
  );
  return result.rows[0] ? (result.rows[0].avatarUrl || null) : null;
}

async function createClipUpload(pool, req, helpers) {
  ensureOriginalsDir();
  const { fields, files } = await readMultipartForm(req);
  const playerId = String(fields.playerId || '').trim();
  const playerName = helpers.normalizeLookup(fields.playerName);
  const situation = helpers.normalizeLookup(fields.situation);
  const skillFocus = parseSkillFocusField(fields.skillFocus);
  const legacySkill = helpers.normalizeLookup(fields.skill || '');
  const primarySkill = skillFocus[0] || legacySkill || 'General';
  const videoFile = files.find((entry) => entry.field === 'video') || files[0];
  const videoUrl = String(fields.videoUrl || fields.sourceUrl || '').trim();
  const findPlayer = parseBooleanField(fields.findPlayer);
  const isLinkMode = Boolean(videoUrl);

  if ((!playerId && !playerName) || !situation) {
    return { status: 400, body: helpers.appError(400, 'validation_error', 'Player and situation are required.') };
  }

  if (!isLinkMode && (!videoFile || !videoFile.buffer || !videoFile.buffer.length)) {
    return { status: 400, body: helpers.appError(400, 'validation_error', 'A video file or video URL is required.') };
  }

  let sourceStartMs = null;
  let sourceDurationMs = null;
  if (isLinkMode) {
    const startSec = parseMmSs(fields.startMmSs || fields.start || '');
    if (startSec == null) {
      return {
        status: 400,
        body: helpers.appError(400, 'validation_error', 'Start time is required as mm:ss (e.g. 01:30).')
      };
    }
    const durationSec = resolveDurationSeconds(fields.durationMmSs || fields.duration);
    if (durationSec == null) {
      return {
        status: 400,
        body: helpers.appError(
          400,
          'validation_error',
          `Duration must be mm:ss between 00:01 and ${String(Math.floor(MAX_DURATION_SEC / 60)).padStart(2, '0')}:${String(MAX_DURATION_SEC % 60).padStart(2, '0')} (default ${String(Math.floor(DEFAULT_DURATION_SEC / 60)).padStart(2, '0')}:${String(DEFAULT_DURATION_SEC % 60).padStart(2, '0')}).`
        )
      };
    }
    sourceStartMs = startSec * 1000;
    sourceDurationMs = durationSec * 1000;
  }

  const resolved = await resolvePlayerId(pool, playerId, playerName, helpers);
  if (resolved.error) {
    return resolved.error;
  }
  const resolvedPlayerId = resolved.resolvedPlayerId;

  if (findPlayer) {
    const avatarUrl = await loadPlayerAvatar(pool, resolvedPlayerId);
    if (!avatarUrl) {
      return {
        status: 400,
        body: helpers.appError(
          400,
          'validation_error',
          'Find player requires the selected player to have a photo assigned.'
        )
      };
    }
  }

  const clipId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const focusPayload = skillFocus.length ? skillFocus : [primarySkill];

  let storagePath = null;
  let safeName = null;
  let mimeType = null;
  let fileSize = null;

  if (!isLinkMode) {
    safeName = sanitizeFilename(videoFile.filename);
    storagePath = path.join(originalsDir(), `${clipId}_${safeName}`);
    fs.writeFileSync(storagePath, videoFile.buffer);
    mimeType = videoFile.mimeType || 'application/octet-stream';
    fileSize = videoFile.buffer.length;
  } else {
    safeName = 'link-source';
    mimeType = 'application/octet-stream';
  }

  await pool.query(
    `
      INSERT INTO clips (
        id, player_id, situation, status, score, summary, submitted_at_label,
        skill, video_storage_path, original_filename, mime_type, file_size_bytes, skill_focus,
        source_url, source_start_ms, source_duration_ms, find_player
      )
      VALUES (
        $1, $2, $3, 'submitted', NULL, '', 'Submitted just now',
        $4, $5, $6, $7, $8, $9::jsonb,
        $10, $11, $12, $13
      )
    `,
    [
      clipId,
      resolvedPlayerId,
      situation,
      primarySkill,
      storagePath,
      safeName,
      mimeType,
      fileSize,
      JSON.stringify(focusPayload),
      isLinkMode ? videoUrl : null,
      sourceStartMs,
      sourceDurationMs,
      findPlayer
    ]
  );

  const created = await selectClipById(pool, clipId);
  const segmentsByClip = await listSegmentsForClips(pool, [clipId]);
  await reconcilePlayerClipStats(pool, resolvedPlayerId);
  logAuditEvent('clip.submitted', {
    clipId,
    playerId: resolvedPlayerId,
    filename: safeName,
    mimeType: mimeType || 'application/octet-stream',
    fileSizeBytes: fileSize,
    skillFocusCount: focusPayload.length,
    path: storagePath,
    sourceUrl: isLinkMode ? videoUrl : null,
    findPlayer
  });
  triggerVideoProcessing(pool);
  return {
    status: 202,
    body: { data: toClipResponse(created, segmentsByClip.get(clipId) || []) }
  };
}

async function reprocessClip(pool, clipId) {
  const existing = await selectClipById(pool, clipId);
  if (!existing) {
    return {
      status: 404,
      body: { status: 404, code: 'not_found', message: 'The selected clip was not found anymore. Refresh and try again.' }
    };
  }
  if (String(existing.status || '').toLowerCase() !== 'failed') {
    return {
      status: 409,
      body: {
        status: 409,
        code: 'conflict',
        message: 'Only failed clips can be re-processed.'
      }
    };
  }

  await pool.query(
    `
      UPDATE clips
      SET status = 'submitted',
          error_message = NULL,
          comments = NULL,
          score = NULL,
          summary = NULL,
          skill_ratings = NULL,
          processing_started_at = NULL,
          processing_completed_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [clipId]
  );

  await reconcilePlayerClipStats(pool, existing.playerId);
  triggerVideoProcessing(pool);

  const updated = await selectClipById(pool, clipId);
  const segmentsByClip = await listSegmentsForClips(pool, [clipId]);
  logAuditEvent('clip.reprocessed', {
    clipId,
    playerId: existing.playerId,
    previousStatus: existing.status
  });
  return {
    status: 202,
    body: { data: toClipResponse(updated, segmentsByClip.get(clipId) || []) }
  };
}

module.exports = {
  createClipUpload,
  reprocessClip,
  selectClipById,
  toClipResponse,
  listSegmentsForClips,
  originalsDir,
  parseMmSs,
  resolveDurationSeconds
};
