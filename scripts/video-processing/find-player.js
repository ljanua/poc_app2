'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getOllamaBaseUrl, getOllamaVideoModel } = require('./config');
const { extractFrameAt } = require('./link-ingest');
const { logAuditEvent } = require('./audit-logger');

const SAMPLE_INTERVAL_SEC = 1;

function avatarUrlToBase64(avatarUrl) {
  const raw = String(avatarUrl || '').trim();
  if (!raw) {
    return null;
  }
  const dataMatch = /^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/s.exec(raw);
  if (dataMatch) {
    return dataMatch[1].replace(/\s+/g, '');
  }
  if (fs.existsSync(raw)) {
    return fs.readFileSync(raw).toString('base64');
  }
  // Relative mockup paths like /data/... are not readable here without HTTP.
  return null;
}

async function avatarUrlToBase64Async(avatarUrl, fetchBaseUrl) {
  const local = avatarUrlToBase64(avatarUrl);
  if (local) {
    return local;
  }
  const raw = String(avatarUrl || '').trim();
  if (!raw) {
    return null;
  }
  let absolute = raw;
  if (raw.startsWith('/') && fetchBaseUrl) {
    absolute = String(fetchBaseUrl).replace(/\/$/, '') + raw;
  }
  if (!/^https?:\/\//i.test(absolute)) {
    return null;
  }
  const response = await fetch(absolute);
  if (!response.ok) {
    throw new Error(`Could not fetch player avatar (${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

function parseMatchResponse(text) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.match === 'boolean') {
      return parsed.match;
    }
    if (typeof parsed.found === 'boolean') {
      return parsed.found;
    }
  } catch (error) {
    // fall through
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (typeof parsed.match === 'boolean') {
        return parsed.match;
      }
      if (typeof parsed.found === 'boolean') {
        return parsed.found;
      }
    } catch (inner) {
      // fall through
    }
  }
  if (/\b(yes|true|match|found)\b/.test(raw) && !/\b(no|false|not found|no match)\b/.test(raw)) {
    return true;
  }
  return false;
}

async function askOllamaIfPlayerPresent(pool, { avatarBase64, frameBase64 }) {
  const baseUrl = (await getOllamaBaseUrl(pool)).replace(/\/$/, '');
  const model = await getOllamaVideoModel(pool);
  const prompt = [
    'Image 1 is a reference photo of a specific soccer player.',
    'Image 2 is a single video frame.',
    'Does the same player from the reference photo appear clearly in the video frame?',
    'Respond with JSON only: {"match":true} or {"match":false}.'
  ].join(' ');

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{
        role: 'user',
        content: prompt,
        images: [avatarBase64, frameBase64]
      }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama find-player request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const content = payload && payload.message && payload.message.content
    ? payload.message.content
    : '';
  return parseMatchResponse(content);
}

/**
 * Scan from startSec to mediaEndSec (inclusive of start) at SAMPLE_INTERVAL_SEC.
 * Returns matched timestamp in seconds, or null if never found.
 */
async function findPlayerInVideo(pool, {
  clipId,
  videoPath,
  startSec,
  mediaEndSec,
  avatarUrl,
  framesDir,
  fetchBaseUrl
}) {
  const avatarBase64 = await avatarUrlToBase64Async(avatarUrl, fetchBaseUrl);
  if (!avatarBase64) {
    throw new Error('Find player requires a readable player photo (avatar).');
  }

  fs.mkdirSync(framesDir, { recursive: true });
  const end = Math.max(startSec, mediaEndSec);
  logAuditEvent('clip.find_player.started', {
    clipId,
    startSec,
    endSec: end,
    intervalSec: SAMPLE_INTERVAL_SEC
  });

  for (let at = startSec; at <= end + 0.001; at += SAMPLE_INTERVAL_SEC) {
    const framePath = path.join(framesDir, `find_${String(Math.floor(at)).padStart(5, '0')}.jpg`);
    try {
      await extractFrameAt(videoPath, at, framePath);
    } catch (error) {
      logAuditEvent('clip.find_player.frame_error', {
        clipId,
        atSec: at,
        error: error.message || String(error)
      });
      continue;
    }
    if (!fs.existsSync(framePath) || fs.statSync(framePath).size < 32) {
      continue;
    }
    const frameBase64 = fs.readFileSync(framePath).toString('base64');
    let matched = false;
    try {
      matched = await askOllamaIfPlayerPresent(pool, { avatarBase64, frameBase64 });
    } catch (error) {
      logAuditEvent('clip.find_player.ollama_error', {
        clipId,
        atSec: at,
        error: error.message || String(error)
      });
      throw error;
    }
    if (matched) {
      logAuditEvent('clip.find_player.matched', { clipId, matchedSec: at });
      return at;
    }
  }

  logAuditEvent('clip.find_player.missed', { clipId, startSec, endSec: end });
  return null;
}

module.exports = {
  SAMPLE_INTERVAL_SEC,
  avatarUrlToBase64,
  avatarUrlToBase64Async,
  parseMatchResponse,
  findPlayerInVideo
};
