'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getVideoRoot, thumbnailPathForClip } = require('./config');
const { listSegmentsForClips, selectClipById } = require('./clip-upload');

function isPathUnderVideoRoot(filePath) {
  if (!filePath) {
    return false;
  }
  const root = getVideoRoot();
  const resolved = path.resolve(String(filePath));
  const rel = path.relative(root, resolved);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Resolve a playable filesystem path for a clip.
 * @param {import('pg').Pool} pool
 * @param {string} clipId
 * @param {'first'|'original'} source
 * @returns {Promise<{ filePath: string|null, status: number, code?: string, message?: string }>}
 */
async function resolveClipMediaPath(pool, clipId, source) {
  const id = String(clipId || '').trim();
  if (!id) {
    return { filePath: null, status: 400, code: 'validation_error', message: 'clipId is required.' };
  }

  const sourceKey = String(source || 'first').trim().toLowerCase();
  if (sourceKey !== 'first' && sourceKey !== 'original') {
    return {
      filePath: null,
      status: 400,
      code: 'validation_error',
      message: 'source must be first or original.'
    };
  }

  const clip = await selectClipById(pool, id);
  if (!clip) {
    return { filePath: null, status: 404, code: 'not_found', message: 'Clip not found.' };
  }

  let candidate = null;
  if (sourceKey === 'first') {
    const segmentsByClip = await listSegmentsForClips(pool, [id]);
    const segments = segmentsByClip.get(id) || [];
    if (segments.length) {
      candidate = segments[0].path;
    } else {
      candidate = clip.path || clip.videoStoragePath || null;
    }
  } else {
    candidate = clip.path || clip.videoStoragePath || null;
  }

  if (!candidate) {
    return { filePath: null, status: 404, code: 'not_found', message: 'No video file is available for this clip.' };
  }

  const resolved = path.resolve(String(candidate));
  if (!isPathUnderVideoRoot(resolved)) {
    return { filePath: null, status: 404, code: 'not_found', message: 'No video file is available for this clip.' };
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { filePath: null, status: 404, code: 'not_found', message: 'No video file is available for this clip.' };
  }

  return { filePath: resolved, status: 200 };
}

/**
 * Resolve the durable JPEG poster path for a clip (convention: thumbnails/{clipId}.jpg).
 */
async function resolveClipThumbnailPath(pool, clipId) {
  const id = String(clipId || '').trim();
  if (!id) {
    return { filePath: null, status: 400, code: 'validation_error', message: 'clipId is required.' };
  }

  const clip = await selectClipById(pool, id);
  if (!clip) {
    return { filePath: null, status: 404, code: 'not_found', message: 'Clip not found.' };
  }

  const candidate = thumbnailPathForClip(id);
  const resolved = path.resolve(String(candidate));
  if (!isPathUnderVideoRoot(resolved)) {
    return { filePath: null, status: 404, code: 'not_found', message: 'No thumbnail is available for this clip.' };
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { filePath: null, status: 404, code: 'not_found', message: 'No thumbnail is available for this clip.' };
  }

  return { filePath: resolved, status: 200 };
}

function parseRange(rangeHeader, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader || '').trim());
  if (!match) {
    return null;
  }
  const start = match[1] === '' ? 0 : Number.parseInt(match[1], 10);
  const end = match[2] === '' ? fileSize - 1 : Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start < 0 || end >= fileSize) {
    return null;
  }
  return { start, end };
}

function streamVideoFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = parseRange(req.headers.range, fileSize);

  if (range) {
    const chunkSize = range.end - range.start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
      'Cache-Control': 'private, max-age=0'
    });
    fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=0'
  });
  fs.createReadStream(filePath).pipe(res);
}

function streamJpegFile(res, filePath) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=300'
  });
  fs.createReadStream(filePath).pipe(res);
}

module.exports = {
  isPathUnderVideoRoot,
  resolveClipMediaPath,
  resolveClipThumbnailPath,
  streamVideoFile,
  streamJpegFile
};
