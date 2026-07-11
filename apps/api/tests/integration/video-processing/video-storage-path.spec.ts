import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('video storage root and clip path', () => {
  let previousRoot: string | undefined;
  let tempRoot: string;

  beforeEach(() => {
    previousRoot = process.env.VANTAGEIQ_VIDEO_ROOT;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vantageiq-video-root-'));
    process.env.VANTAGEIQ_VIDEO_ROOT = tempRoot;
  });

  afterEach(() => {
    if (previousRoot === undefined) {
      delete process.env.VANTAGEIQ_VIDEO_ROOT;
    } else {
      process.env.VANTAGEIQ_VIDEO_ROOT = previousRoot;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('resolves originals and segments under the configured root', async () => {
    const {
      getVideoRoot,
      originalsDir,
      segmentsDirForClip,
      ensureOriginalsDir,
      ensureSegmentsDirForClip
    } = await import('../../../../../scripts/video-processing/config.js');

    expect(getVideoRoot()).toBe(path.resolve(tempRoot));
    expect(originalsDir()).toBe(path.join(path.resolve(tempRoot), 'originals'));
    expect(segmentsDirForClip('c_1')).toBe(path.join(path.resolve(tempRoot), 'segments', 'c_1'));

    const originals = ensureOriginalsDir();
    const segments = ensureSegmentsDirForClip('c_1');
    expect(fs.existsSync(originals)).toBe(true);
    expect(fs.existsSync(segments)).toBe(true);
  });

  it('defaults to C:/vantageiq_videos when env is unset', async () => {
    delete process.env.VANTAGEIQ_VIDEO_ROOT;
    const { getVideoRoot, DEFAULT_VIDEO_ROOT } = await import('../../../../../scripts/video-processing/config.js');
    expect(getVideoRoot()).toBe(path.resolve(DEFAULT_VIDEO_ROOT));
  });

  it('exposes path and segments on toClipResponse', async () => {
    const { toClipResponse } = await import('../../../../../scripts/video-processing/clip-upload.js');
    const payload = toClipResponse(
      {
        id: 'c_1',
        playerId: 'p_1',
        playerName: 'Test',
        teamName: 'U19',
        situation: 'Drill',
        status: 'complete',
        score: 0.8,
        summary: '',
        comments: null,
        submittedAt: 'now',
        skill: 'Pace',
        skillFocus: ['Pace'],
        skillRatings: { Pace: 0.8 },
        errorMessage: null,
        videoStoragePath: 'C:\\vantageiq_videos\\originals\\c_1_clip.mp4'
      },
      [{ index: 0, path: 'C:\\vantageiq_videos\\segments\\c_1\\segment_000.mp4' }]
    );
    expect(payload.path).toBe('C:\\vantageiq_videos\\originals\\c_1_clip.mp4');
    expect(payload.segments).toEqual([
      { index: 0, path: 'C:\\vantageiq_videos\\segments\\c_1\\segment_000.mp4' }
    ]);
  });
});
