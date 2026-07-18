import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('shared structured-logger', () => {
  let tempLogPath: string;
  let previousStructured: string | undefined;
  let previousLegacy: string | undefined;

  beforeEach(() => {
    tempLogPath = path.join(os.tmpdir(), `structured-log-${Date.now()}-${Math.random()}.txt`);
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

  it('defaults getLogPath under log/ when no env override', async () => {
    delete process.env.STRUCTURED_LOG_PATH;
    delete process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
    const { getLogPath } = await import('../../../../../scripts/logging/structured-logger.js');
    const resolved = getLogPath();
    expect(resolved.replace(/\\/g, '/')).toMatch(/\/log\/backend_logging\.txt$/);
  });

  it('uses VIDEO_PROCESSING_AUDIT_LOG_PATH when STRUCTURED_LOG_PATH unset', async () => {
    const legacyPath = path.join(os.tmpdir(), `legacy-audit-${Date.now()}-${Math.random()}.txt`);
    delete process.env.STRUCTURED_LOG_PATH;
    process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = legacyPath;
    const { getLogPath } = await import('../../../../../scripts/logging/structured-logger.js');
    expect(getLogPath()).toBe(path.resolve(legacyPath));
  });

  it('prefers STRUCTURED_LOG_PATH over legacy VIDEO_PROCESSING_AUDIT_LOG_PATH', async () => {
    const legacyPath = path.join(os.tmpdir(), `legacy-audit-${Date.now()}-${Math.random()}.txt`);
    process.env.STRUCTURED_LOG_PATH = tempLogPath;
    process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH = legacyPath;
    const { getLogPath } = await import('../../../../../scripts/logging/structured-logger.js');
    expect(getLogPath()).toBe(path.resolve(tempLogPath));
  });

  it('writes timestamp, functionality, and optional userId', async () => {
    const { logEvent, getLogPath } = await import('../../../../../scripts/logging/structured-logger.js');
    expect(getLogPath()).toBe(tempLogPath);

    logEvent({ functionality: 'api.login', userId: 'u_1', details: { ok: true } });
    logEvent({ functionality: 'queue.started', details: { pollIntervalMs: 5000 } });

    const lines = fs.readFileSync(tempLogPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z api\.login /);
    expect(lines[0]).toContain('"userId":"u_1"');
    expect(lines[0]).toContain('"ok":true');
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z queue\.started /);
    expect(lines[1]).not.toContain('userId');
  });

  it('does not throw when log path is invalid', async () => {
    const blocker = path.join(os.tmpdir(), `structured-blocker-${Date.now()}`);
    fs.writeFileSync(blocker, 'x');
    process.env.STRUCTURED_LOG_PATH = path.join(blocker, 'nested', 'app.log');
    const { logEvent } = await import('../../../../../scripts/logging/structured-logger.js');

    expect(() => {
      logEvent({ functionality: 'server.started', details: { port: 5500 } });
    }).not.toThrow();

    fs.unlinkSync(blocker);
  });
});
