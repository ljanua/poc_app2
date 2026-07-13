'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const SEGMENT_SECONDS = 30;
const FRAMES_PER_SEGMENT = 3;

const FFMPEG_INSTALL_HINT =
  'Install ffmpeg and add it to PATH, or set FFMPEG_PATH / processing_config.ffmpeg_path. ' +
  'Windows: winget install Gyan.FFmpeg';

let ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

function setFfmpegPath(path) {
  ffmpegPath = path || 'ffmpeg';
}

function getFfmpegPath() {
  return ffmpegPath;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (error && error.code === 'ENOENT' && command === ffmpegPath) {
        reject(new Error(`ffmpeg not found (${ffmpegPath}). ${FFMPEG_INSTALL_HINT}`));
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

async function ensureFfmpegAvailable() {
  await runCommand(ffmpegPath, ['-version']);
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDirRecursive(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return;
  }
  fs.rmSync(dirPath, { recursive: true, force: true });
}

async function segmentVideo(videoPath, outputDir) {
  const pattern = path.join(outputDir, 'segment_%03d.mp4');
  await runCommand(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', videoPath,
    '-c', 'copy',
    '-map', '0',
    '-f', 'segment',
    '-segment_time', String(SEGMENT_SECONDS),
    '-reset_timestamps', '1',
    pattern
  ]);

  return fs.readdirSync(outputDir)
    .filter((name) => name.startsWith('segment_') && name.endsWith('.mp4'))
    .sort()
    .map((name) => path.join(outputDir, name));
}

async function extractSegmentFrames(segmentPath, framesDir) {
  const baseName = path.basename(segmentPath, '.mp4');
  const outputPattern = path.join(framesDir, `${baseName}_%03d.jpg`);
  await runCommand(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', segmentPath,
    '-vf', `fps=${FRAMES_PER_SEGMENT}/${SEGMENT_SECONDS}`,
    '-frames:v', String(FRAMES_PER_SEGMENT),
    outputPattern
  ]);

  return fs.readdirSync(framesDir)
    .filter((name) => name.startsWith(baseName) && name.endsWith('.jpg'))
    .sort()
    .map((name) => path.join(framesDir, name));
}

async function extractPosterFrame(videoPath, outputJpegPath) {
  const dir = path.dirname(outputJpegPath);
  fs.mkdirSync(dir, { recursive: true });
  await runCommand(ffmpegPath, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    outputJpegPath
  ]);
  return outputJpegPath;
}

function readFramesAsBase64(framePaths) {
  return framePaths.map((framePath) => fs.readFileSync(framePath).toString('base64'));
}

module.exports = {
  SEGMENT_SECONDS,
  runCommand,
  setFfmpegPath,
  getFfmpegPath,
  ensureFfmpegAvailable,
  createTempDir,
  removeDirRecursive,
  segmentVideo,
  extractSegmentFrames,
  extractPosterFrame,
  readFramesAsBase64
};
