'use strict';

const { getMaxParallelProcesses, getFfmpegPath: resolveFfmpegPath } = require('./config');
const { processClip } = require('./process-clip');
const { ensureFfmpegAvailable, setFfmpegPath, getFfmpegPath } = require('./ffmpeg-utils');
const { logAuditEvent } = require('./audit-logger');

const activeClipIds = new Set();
let pollTimer = null;

async function countInProgress(pool) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM clips WHERE status = 'in_progress'`
  );
  return result.rows[0] ? result.rows[0].count : 0;
}

async function claimNextSubmittedClip(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const maxParallel = await getMaxParallelProcesses(pool);
    const inProgress = await countInProgress(pool);
    if (inProgress >= maxParallel) {
      await client.query('ROLLBACK');
      return null;
    }

    const next = await client.query(
      `
        SELECT id
        FROM clips
        WHERE status = 'submitted'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `
    );
    if (!next.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const clipId = next.rows[0].id;
    await client.query(
      `
        UPDATE clips
        SET status = 'in_progress',
            processing_started_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [clipId]
    );
    await client.query('COMMIT');
    logAuditEvent('clip.claimed', { clipId });
    return clipId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function dispatchOne(pool) {
  const clipId = await claimNextSubmittedClip(pool);
  if (!clipId || activeClipIds.has(clipId)) {
    return false;
  }

  activeClipIds.add(clipId);
  processClip(pool, clipId)
    .catch((error) => {
      console.error(`Unhandled clip processing error for ${clipId}:`, error);
      logAuditEvent('clip.unhandled_error', {
        clipId,
        error: error && error.message ? error.message : String(error)
      });
    })
    .finally(() => {
      activeClipIds.delete(clipId);
      setImmediate(() => {
        dispatchOne(pool).catch((error) => {
          console.error('Video processing dispatch error:', error);
          logAuditEvent('clip.dispatch.error', {
            error: error && error.message ? error.message : String(error)
          });
        });
      });
    });
  return true;
}

async function tick(pool) {
  const maxParallel = await getMaxParallelProcesses(pool);
  const inProgress = await countInProgress(pool);
  const slots = Math.max(0, maxParallel - inProgress - activeClipIds.size);
  for (let index = 0; index < slots; index += 1) {
    const dispatched = await dispatchOne(pool);
    if (!dispatched) {
      break;
    }
  }
}

function startVideoProcessingQueue(pool) {
  if (!pool || pollTimer) {
    return;
  }

  const intervalMs = Number(process.env.VIDEO_PROCESSING_POLL_MS || 5000);
  pollTimer = setInterval(() => {
    tick(pool).catch((error) => {
      console.error('Video processing queue tick failed:', error);
      logAuditEvent('queue.tick.error', {
        error: error && error.message ? error.message : String(error)
      });
    });
  }, intervalMs);

  tick(pool).catch((error) => {
    console.error('Initial video processing tick failed:', error);
    logAuditEvent('queue.tick.error', {
      error: error && error.message ? error.message : String(error)
    });
  });

  logAuditEvent('queue.started', { pollIntervalMs: intervalMs });
  console.log(`Video processing queue started (poll every ${intervalMs}ms)`);

  resolveFfmpegPath(pool)
    .then((path) => {
      setFfmpegPath(path);
      return ensureFfmpegAvailable();
    })
    .then(() => {
      console.log(`ffmpeg available (${getFfmpegPath()})`);
    })
    .catch((error) => {
      const message = error && error.message ? error.message : String(error);
      console.warn(`Video processing: ${message}`);
      logAuditEvent('queue.ffmpeg.missing', { error: message });
    });
}

function triggerVideoProcessing(pool) {
  if (!pool) {
    return;
  }
  tick(pool).catch((error) => {
    console.error('Video processing trigger failed:', error);
    logAuditEvent('queue.tick.error', {
      error: error && error.message ? error.message : String(error)
    });
  });
}

module.exports = {
  startVideoProcessingQueue,
  triggerVideoProcessing,
  tick,
  claimNextSubmittedClip
};
