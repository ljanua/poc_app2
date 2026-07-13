'use strict';

/**
 * Opaque share-token helpers for guest read-only S2 links (Feature 034).
 * Raw tokens are base64url; only sha256 hex digests are stored.
 */

const crypto = require('node:crypto');

function generateShareToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashShareToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex');
}

module.exports = {
  generateShareToken,
  hashShareToken
};
