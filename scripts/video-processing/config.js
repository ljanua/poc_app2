'use strict';

const fs = require('node:fs');
const path = require('node:path');

async function getProcessingConfig(pool, key, fallback) {
  const result = await pool.query(
    'SELECT value FROM processing_config WHERE key = $1 LIMIT 1',
    [key]
  );
  if (result.rows[0] && result.rows[0].value != null) {
    return String(result.rows[0].value);
  }
  return fallback;
}

async function getMaxParallelProcesses(pool) {
  const raw = await getProcessingConfig(pool, 'max_parallel_video_processes', '1');
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function getOllamaBaseUrl(pool) {
  return getProcessingConfig(
    pool,
    'ollama_base_url',
    process.env.OLLAMA_BASE_URL || 'http://macmini.lan:11434'
  );
}

async function getOllamaVideoModel(pool) {
  return getProcessingConfig(
    pool,
    'ollama_video_model',
    process.env.OLLAMA_VIDEO_MODEL || 'gemma4:12b-mlx'
  );
}

function discoverWindowsWingetFfmpeg() {
  if (process.platform !== 'win32') {
    return null;
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }
  const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  if (!fs.existsSync(packagesDir)) {
    return null;
  }
  const ffmpegPackage = fs.readdirSync(packagesDir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith('Gyan.FFmpeg'));
  if (!ffmpegPackage) {
    return null;
  }
  const packageDir = path.join(packagesDir, ffmpegPackage.name);
  const builds = fs.readdirSync(packageDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.includes('ffmpeg'));
  for (const build of builds) {
    const candidate = path.join(packageDir, build.name, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function getFfmpegPath(pool) {
  const configured = await getProcessingConfig(pool, 'ffmpeg_path', '');
  if (configured) {
    return configured;
  }
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  const wingetPath = discoverWindowsWingetFfmpeg();
  if (wingetPath) {
    return wingetPath;
  }
  return 'ffmpeg';
}

module.exports = {
  getProcessingConfig,
  getMaxParallelProcesses,
  getOllamaBaseUrl,
  getOllamaVideoModel,
  getFfmpegPath
};
