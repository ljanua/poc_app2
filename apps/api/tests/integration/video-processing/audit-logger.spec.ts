import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('video-processing audit-logger', () => {
  let tempLogPath: string;
  let previousStructured: string | undefined;
  let previousLegacy: string | undefined;

  beforeEach(() => {
    tempLogPath = path.join(os.tmpdir(), `audit-log-${Date.now()}-${Math.random()}.txt`);
    previousStructured = process.env.STRUCTURED_LOG_PATH;
    previousLegacy = process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    process.env.STRUCTURED_LOG_PATH = tempLogPath;
    delete process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    if (fs.existsSync(tempLogPath)) {
      fs.unlinkSync(tempLogPath);
    }
  });

  afterEach(() => {
    if (previousStructured === undefined) {
      delete process.env.STRUCTURED_LOG_PATH;
    } else {
      process.env.STRUCTURED_LOG_PATH = previousStructured;
    }
    if (previousLegacy === undefined) {
      delete process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    } else {
      process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = previousLegacy;
    }
    if (fs.existsSync(tempLogPath)) {
      fs.unlinkSync(tempLogPath);
    }
  });

  it('appends timestamped event lines via shared logger', async () => {
    const { logAuditEvent, getLogPath } = await import('../../../../../scripts/video-processing/audit-logger.js');

    expect(getLogPath()).toBe(tempLogPath);

    logAuditEvent('clip.claimed', { clipId: 'c_1', playerId: 'p_10' });
    logAuditEvent('clip.complete', { clipId: 'c_1', score: 0.75 });

    const content = fs.readFileSync(tempLogPath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z clip\.claimed \{"clipId":"c_1","playerId":"p_10"\}$/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z clip\.complete \{"clipId":"c_1","score":0\.75\}$/);
  });

  it('passes through userId when provided in details', async () => {
    const { logAuditEvent } = await import('../../../../../scripts/video-processing/audit-logger.js');
    logAuditEvent('clip.submitted', { clipId: 'c_2', userId: '42' });
    const line = fs.readFileSync(tempLogPath, 'utf8').trim();
    expect(line).toContain('clip.submitted');
    expect(line).toContain('"userId":"42"');
  });

  it('does not throw when log path is invalid', async () => {
    const blocker = path.join(os.tmpdir(), `audit-blocker-${Date.now()}`);
    fs.writeFileSync(blocker, 'x');
    process.env.STRUCTURED_LOG_PATH = path.join(blocker, 'nested', 'audit.log');
    const { logAuditEvent } = await import('../../../../../scripts/video-processing/audit-logger.js');

    expect(() => {
      logAuditEvent('queue.tick.error', { message: 'test' });
    }).not.toThrow();

    fs.unlinkSync(blocker);
  });
});
