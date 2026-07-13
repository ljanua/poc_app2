'use strict';

/**
 * Shared structured logger for mockup server + video processing.
 *
 * Path precedence:
 * 1. STRUCTURED_LOG_PATH
 * 2. VIDEO_PROCESSING_AUDIT_LOG_PATH (compat)
 * 3. <cwd>/log/backend_logging.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LOG_DIR = 'log';
const DEFAULT_LOG_FILENAME = 'backend_logging.txt';

function getLogPath() {
  const primary = process.env.STRUCTURED_LOG_PATH;
  if (primary && String(primary).trim()) {
    return path.resolve(String(primary).trim());
  }
  const legacy = process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
  if (legacy && String(legacy).trim()) {
    return path.resolve(String(legacy).trim());
  }
  return path.join(process.cwd(), DEFAULT_LOG_DIR, DEFAULT_LOG_FILENAME);
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return {};
  }
  const copy = { ...details };
  if (typeof copy.situation === 'string' && copy.situation.length > 200) {
    copy.situation = copy.situation.slice(0, 200);
  }
  delete copy.password;
  delete copy.passwordHash;
  delete copy.token;
  delete copy.shareToken;
  delete copy.rawToken;
  return copy;
}

/**
 * @param {{ functionality: string, userId?: string|number|null, details?: object }} opts
 */
function logEvent(opts) {
  const functionality = String((opts && opts.functionality) || 'unknown.event').trim();
  const details = sanitizeDetails(opts && opts.details);
  const userId = opts && opts.userId != null && opts.userId !== '' ? opts.userId : undefined;
  if (userId !== undefined) {
    details.userId = userId;
  }
  const line = `${new Date().toISOString()} ${functionality} ${JSON.stringify(details)}\n`;

  try {
    const logPath = getLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (error) {
    console.error('structured-logger failed to write:', error);
    console.error('structured log event:', functionality, details);
  }
}

module.exports = {
  getLogPath,
  logEvent,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILENAME
};
