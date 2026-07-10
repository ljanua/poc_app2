import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('video-processing audit-logger', () => {
  let tempLogPath: string;
  let previousPath: string | undefined;

  beforeEach(() => {
    tempLogPath = path.join(os.tmpdir(), `audit-log-${Date.now()}-${Math.random()}.txt`);
    previousPath = process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = tempLogPath;
    if (fs.existsSync(tempLogPath)) {
      fs.unlinkSync(tempLogPath);
    }
  });

  afterEach(() => {
    if (previousPath === undefined) {
      delete process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    } else {
      process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = previousPath;
    }
    if (fs.existsSync(tempLogPath)) {
      fs.unlinkSync(tempLogPath);
    }
  });

  it('appends timestamped event lines', async () => {
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

  it('does not throw when log path is invalid', async () => {
    const blocker = path.join(os.tmpdir(), `audit-blocker-${Date.now()}`);
    fs.writeFileSync(blocker, 'x');
    process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = path.join(blocker, 'nested', 'audit.log');
    const { logAuditEvent } = await import('../../../../../scripts/video-processing/audit-logger.js');

    expect(() => {
      logAuditEvent('queue.tick.error', { message: 'test' });
    }).not.toThrow();

    fs.unlinkSync(blocker);
  });
});
