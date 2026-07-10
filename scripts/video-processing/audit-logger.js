'use strict';

const {
  getLogPath,
  logEvent
} = require('../logging/structured-logger');

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

/**
 * Feature 019 compatibility wrapper around the shared structured logger.
 * Maps event → functionality; passes through details.userId when present.
 */
function logAuditEvent(event, details) {
  const eventName = String(event || 'unknown.event').trim();
  const payload = sanitizeDetails(details);
  const userId = payload.userId;
  if (userId !== undefined) {
    delete payload.userId;
  }
  logEvent({
    functionality: eventName,
    userId,
    details: payload
  });
}

module.exports = {
  getLogPath,
  logAuditEvent
};
