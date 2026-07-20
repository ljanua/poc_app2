'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { originalsDir, ensureOriginalsDir } = require('./config');
const { runCommand, getFfmpegPath, SEGMENT_SECONDS, MAX_SEGMENTS } = require('./ffmpeg-utils');
const { logAuditEvent } = require('./audit-logger');

const MIN_DURATION_SEC = 1;
/** Analysis window max = segment length × max segments (10s × 3). */
const MAX_DURATION_SEC = SEGMENT_SECONDS * MAX_SEGMENTS;
const DEFAULT_DURATION_SEC = MAX_DURATION_SEC;

function parseMmSs(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) {
    return null;
  }
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(raw);
  if (!match) {
    return null;
  }
  return (Number(match[1]) * 60) + Number(match[2]);
}

function formatMmSs(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function validateDurationSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < MIN_DURATION_SEC || seconds > MAX_DURATION_SEC) {
    return false;
  }
  return true;
}

function resolveDurationSeconds(rawValue) {
  if (rawValue == null || String(rawValue).trim() === '') {
    return DEFAULT_DURATION_SEC;
  }
  const parsed = parseMmSs(rawValue);
  if (parsed == null || !validateDurationSeconds(parsed)) {
    return null;
  }
  return parsed;
}

function looksLikeDirectMediaUrl(url) {
  const lower = String(url || '').toLowerCase();
  return /\.(mp4|mov|m4v|webm|mkv)(\?|#|$)/.test(lower);
}

function runSpawn(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (error && error.code === 'ENOENT') {
        reject(new Error(
          `yt-dlp not found (${command}). Install yt-dlp and add it to PATH, or set processing_config.ytdlp_path / YTDLP_PATH.`
        ));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
    });
  });
}

async function downloadWithYtdlp(ytdlpPath, url, outputTemplate) {
  await runSpawn(ytdlpPath, [
    '--no-playlist',
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b',
    '--merge-output-format', 'mp4',
    '-o', outputTemplate,
    url
  ]);
}

async function downloadDirect(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Direct download failed (${response.status}) for ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error('Direct download returned an empty file.');
  }
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function downloadSourceVideo({ url, clipId, ytdlpPath }) {
  ensureOriginalsDir();
  const safeBase = `${clipId}_source`;
  const outputTemplate = path.join(originalsDir(), `${safeBase}.%(ext)s`);
  const preferredMp4 = path.join(originalsDir(), `${safeBase}.mp4`);

  logAuditEvent('clip.link.download.started', { clipId, url });

  try {
    if (looksLikeDirectMediaUrl(url)) {
      await downloadDirect(url, preferredMp4);
      logAuditEvent('clip.link.download.complete', { clipId, path: preferredMp4, method: 'direct' });
      return preferredMp4;
    }

    await downloadWithYtdlp(ytdlpPath || 'yt-dlp', url, outputTemplate);
    const matches = fs.readdirSync(originalsDir())
      .filter((name) => name.startsWith(safeBase + '.'))
      .map((name) => path.join(originalsDir(), name));
    if (!matches.length) {
      throw new Error('yt-dlp finished but no output file was found.');
    }
    const chosen = matches.find((entry) => entry.toLowerCase().endsWith('.mp4')) || matches[0];
    logAuditEvent('clip.link.download.complete', { clipId, path: chosen, method: 'yt-dlp' });
    return chosen;
  } catch (error) {
    // Hosted URL failed with yt-dlp missing: try direct fetch as last resort.
    if (!looksLikeDirectMediaUrl(url) && error && /yt-dlp not found/i.test(error.message || '')) {
      throw error;
    }
    if (!looksLikeDirectMediaUrl(url)) {
      try {
        await downloadDirect(url, preferredMp4);
        logAuditEvent('clip.link.download.complete', { clipId, path: preferredMp4, method: 'direct-fallback' });
        return preferredMp4;
      } catch (fallbackError) {
        throw error;
      }
    }
    throw error;
  }
}

async function probeDurationSeconds(videoPath) {
  const ffprobe = getFfmpegPath().replace(/ffmpeg(\.exe)?$/i, (match, exe) => `ffprobe${exe || ''}`);
  try {
    const { stdout } = await runCommand(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);
    const seconds = Number.parseFloat(String(stdout).trim());
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds;
    }
  } catch (error) {
    // Fall through to ffmpeg-based estimate failure.
  }
  throw new Error('Could not determine video duration.');
}

async function probeFps(videoPath) {
  const ffprobe = getFfmpegPath().replace(/ffmpeg(\.exe)?$/i, (match, exe) => `ffprobe${exe || ''}`);
  try {
    const { stdout } = await runCommand(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=avg_frame_rate,r_frame_rate',
      '-of', 'json',
      videoPath
    ]);
    const parsed = JSON.parse(String(stdout || '{}'));
    const stream = parsed && Array.isArray(parsed.streams) ? parsed.streams[0] : null;
    if (!stream) {
      return null;
    }
    const rate = stream.avg_frame_rate && stream.avg_frame_rate !== '0/0'
      ? stream.avg_frame_rate
      : stream.r_frame_rate;
    if (!rate || typeof rate !== 'string' || rate === '0/0') {
      return null;
    }
    const parts = rate.split('/');
    const num = Number.parseFloat(parts[0]);
    const den = Number.parseFloat(parts[1] || '1');
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return null;
    }
    return num / den;
  } catch (error) {
    return null;
  }
}

function shouldApplyMaxFpsFilter(sourceFps, maxFps) {
  if (!Number.isFinite(sourceFps) || sourceFps <= 0) {
    // Unknown fps: apply the cap filter to be safe for AI input.
    return true;
  }
  return sourceFps > maxFps;
}

async function reencodeToMp4(inputPath, outputPath, { startSec, durationSec, maxFps }) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  const fpsCap = Number.isFinite(maxFps) && maxFps > 0 ? maxFps : 30;
  const sourceFps = await probeFps(inputPath);
  const applyFps = shouldApplyMaxFpsFilter(sourceFps, fpsCap);

  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y'
  ];
  if (startSec != null && Number.isFinite(startSec) && startSec > 0) {
    args.push('-ss', String(startSec));
  }
  args.push('-i', inputPath);
  if (durationSec != null && Number.isFinite(durationSec) && durationSec > 0) {
    args.push('-t', String(durationSec));
  }
  if (applyFps) {
    args.push('-vf', `fps=${fpsCap}`);
  }
  args.push(
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outputPath
  );
  await runCommand(getFfmpegPath(), args);
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
    throw new Error('ffmpeg re-encode produced an empty or missing output file.');
  }
  return {
    outputPath,
    sourceFps,
    appliedFpsCap: applyFps ? fpsCap : null
  };
}

/**
 * Extract [startSec, startSec+durationSec) and ensure output fps is at most maxFps.
 */
async function extractWindowMaxFps(inputPath, outputPath, startSec, durationSec, maxFps) {
  return reencodeToMp4(inputPath, outputPath, {
    startSec: Math.max(0, Number(startSec) || 0),
    durationSec: Math.max(1, Number(durationSec) || 1),
    maxFps: maxFps == null ? 30 : maxFps
  });
}

/**
 * Re-encode full file so fps is at most maxFps (no time window).
 */
async function normalizeMaxFps(inputPath, outputPath, maxFps) {
  return reencodeToMp4(inputPath, outputPath, {
    startSec: null,
    durationSec: null,
    maxFps: maxFps == null ? 30 : maxFps
  });
}

/** @deprecated Prefer extractWindowMaxFps for AI working files. */
async function trimVideoWindow(inputPath, outputPath, startSec, durationSec) {
  const result = await extractWindowMaxFps(inputPath, outputPath, startSec, durationSec, 30);
  return result.outputPath;
}

async function extractFrameAt(videoPath, atSec, outputJpegPath) {
  const dir = path.dirname(outputJpegPath);
  fs.mkdirSync(dir, { recursive: true });
  await runCommand(getFfmpegPath(), [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-ss', String(Math.max(0, atSec)),
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    outputJpegPath
  ]);
  return outputJpegPath;
}

module.exports = {
  MIN_DURATION_SEC,
  MAX_DURATION_SEC,
  DEFAULT_DURATION_SEC,
  parseMmSs,
  formatMmSs,
  validateDurationSeconds,
  resolveDurationSeconds,
  looksLikeDirectMediaUrl,
  downloadSourceVideo,
  probeDurationSeconds,
  probeFps,
  shouldApplyMaxFpsFilter,
  extractWindowMaxFps,
  normalizeMaxFps,
  trimVideoWindow,
  extractFrameAt
};
