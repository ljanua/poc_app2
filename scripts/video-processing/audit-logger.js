'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LOG_FILENAME = 'backend_logging.txt';

function getLogPath() {
  const configured = process.env.VIDEO_PROCESSING_AUDIT_LOG_PATH;
  if (configured && String(configured).trim()) {
    return path.resolve(String(configured).trim());
  }
  return path.join(process.cwd(), DEFAULT_LOG_FILENAME);
}

function sanitizeDetails(details) {
  if (!details || typeof details !== 'object') {
    return {};
  }
  const copy = { ...details };
  if (typeof copy.situation === 'string' && copy.situation.length > 200) {
    copy.situation = copy.situation.slice(0, 200);
  }
  return copy;
}

function logAuditEvent(event, details) {
  const eventName = String(event || 'unknown.event').trim();
  const payload = sanitizeDetails(details);
  const line = `${new Date().toISOString()} ${eventName} ${JSON.stringify(payload)}\n`;

  try {
    const logPath = getLogPath();
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (error) {
    console.error('audit-logger failed to write:', error);
    console.error('audit event:', eventName, payload);
  }
}

module.exports = {
  getLogPath,
  logAuditEvent
};
