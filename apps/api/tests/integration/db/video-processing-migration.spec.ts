import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('019 clips video processing migration', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations', '019_clips_video_processing.sql'),
    'utf8'
  );

  it('defines processing_config and clip video columns', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS processing_config');
    expect(migration).toContain('max_parallel_video_processes');
    expect(migration).toContain('video_storage_path');
    expect(migration).toContain('skill_focus');
    expect(migration).toContain('skill_ratings');
  });

  it('uses submitted, in_progress, complete, failed statuses', () => {
    expect(migration).toContain("'submitted'");
    expect(migration).toContain("'in_progress'");
    expect(migration).toContain("'complete'");
    expect(migration).toContain("'failed'");
  });
});
