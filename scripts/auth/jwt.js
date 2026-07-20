'use strict';

const crypto = require('node:crypto');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'vantagiq-dev-jwt-secret-change-me';
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

function signJwt(payload, options) {
  const opts = options || {};
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, {
    iat: now,
    exp: now + (opts.expiresInSec || 60 * 60 * 12)
  });
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

function verifyJwt(token) {
  const raw = String(token || '').trim();
  if (!raw || raw.startsWith('jwt-')) {
    return { ok: false, error: 'invalid_token' };
  }
  const parts = raw.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'invalid_token' };
  }
  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', getJwtSecret()).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const actualBuf = Buffer.from(parts[2]);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return { ok: false, error: 'invalid_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (_err) {
    return { ok: false, error: 'invalid_payload' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > Number(payload.exp)) {
    return { ok: false, error: 'expired' };
  }
  if (payload.status && payload.status !== 'active') {
    return { ok: false, error: 'inactive' };
  }
  if (payload.approvalStatus && payload.approvalStatus !== 'active') {
    return { ok: false, error: 'pending_or_rejected' };
  }
  return { ok: true, payload };
}

function issueAccessToken(user, tier) {
  return signJwt({
    sub: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    approvalStatus: user.approvalStatus || user.approval_status || 'active',
    tier: tier && (tier.code || tier.tierCode) ? (tier.code || tier.tierCode) : null,
    tierId: tier && (tier.id || tier.tierId) ? (tier.id || tier.tierId) : (user.subscriptionTierId || user.subscription_tier_id || null)
  });
}

module.exports = {
  signJwt,
  verifyJwt,
  issueAccessToken,
  getJwtSecret
};
