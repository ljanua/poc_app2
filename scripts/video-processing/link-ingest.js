'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { originalsDir, ensureOriginalsDir } = require('./config');
const { runCommand, getFfmpegPath } = require('./ffmpeg-utils');
const { logAuditEvent } = require('./audit-logger');

const MIN_DURATION_SEC = 1;
const MAX_DURATION_SEC = 120;
const DEFAULT_DURATION_SEC = 60;

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

async function trimVideoWindow(inputPath, outputPath, startSec, durationSec) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  await runCommand(getFfmpegPath(), [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-ss', String(startSec),
    '-i', inputPath,
    '-t', String(durationSec),
    '-c', 'copy',
    outputPath
  ]);
  // If stream copy fails to produce a readable file length, re-encode once.
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
    await runCommand(getFfmpegPath(), [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-ss', String(startSec),
      '-i', inputPath,
      '-t', String(durationSec),
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath
    ]);
  }
  return outputPath;
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
  trimVideoWindow,
  extractFrameAt
};
