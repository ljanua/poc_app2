import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('video-processing thumbnail paths', () => {
  it('places clip posters under thumbnails/{clipId}.jpg', async () => {
    const {
      getVideoRoot,
      thumbnailPathForClip
    } = await import('../../../../../scripts/video-processing/config.js');

    const root = getVideoRoot();
    expect(thumbnailPathForClip('c_abc')).toBe(path.join(root, 'thumbnails', 'c_abc.jpg'));
  });
});
