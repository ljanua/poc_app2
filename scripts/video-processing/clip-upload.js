'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { readMultipartForm, parseSkillFocusField } = require('./read-multipart');
const { triggerVideoProcessing } = require('./queue');
const { logAuditEvent } = require('./audit-logger');
const { reconcilePlayerClipStats } = require('./reconcile-player-clip-stats');
const { ensureOriginalsDir, originalsDir } = require('./config');

function sanitizeFilename(filename) {
  return String(filename || 'clip.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
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

  if ((!playerId && !playerName) || !situation) {
    return { status: 400, body: helpers.appError(400, 'validation_error', 'Player and situation are required.') };
  }
  if (!videoFile || !videoFile.buffer || !videoFile.buffer.length) {
    return { status: 400, body: helpers.appError(400, 'validation_error', 'A video file is required.') };
  }

  let resolvedPlayerId = playerId;
  if (!resolvedPlayerId && playerName) {
    const player = await pool.query(
      `SELECT id FROM players WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [playerName]
    );
    if (!player.rows[0]) {
      return { status: 404, body: helpers.appError(404, 'not_found', 'The selected player was not found anymore. Refresh and try again.') };
    }
    resolvedPlayerId = player.rows[0].id;
  }

  const clipId = `c_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const safeName = sanitizeFilename(videoFile.filename);
  const storagePath = path.join(originalsDir(), `${clipId}_${safeName}`);
  fs.writeFileSync(storagePath, videoFile.buffer);

  const focusPayload = skillFocus.length ? skillFocus : [primarySkill];
  await pool.query(
    `
      INSERT INTO clips (
        id, player_id, situation, status, score, summary, submitted_at_label,
        skill, video_storage_path, original_filename, mime_type, file_size_bytes, skill_focus
      )
      VALUES ($1, $2, $3, 'submitted', NULL, '', 'Submitted just now', $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [
      clipId,
      resolvedPlayerId,
      situation,
      primarySkill,
      storagePath,
      safeName,
      videoFile.mimeType || 'application/octet-stream',
      videoFile.buffer.length,
      JSON.stringify(focusPayload)
    ]
  );

  const created = await selectClipById(pool, clipId);
  const segmentsByClip = await listSegmentsForClips(pool, [clipId]);
  await reconcilePlayerClipStats(pool, resolvedPlayerId);
  logAuditEvent('clip.submitted', {
    clipId,
    playerId: resolvedPlayerId,
    filename: safeName,
    mimeType: videoFile.mimeType || 'application/octet-stream',
    fileSizeBytes: videoFile.buffer.length,
    skillFocusCount: focusPayload.length,
    path: storagePath
  });
  triggerVideoProcessing(pool);
  return {
    status: 202,
    body: { data: toClipResponse(created, segmentsByClip.get(clipId) || []) }
  };
}

module.exports = {
  createClipUpload,
  selectClipById,
  toClipResponse,
  listSegmentsForClips,
  originalsDir
};
