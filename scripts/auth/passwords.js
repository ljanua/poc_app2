'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const PREFIX = 'scrypt$';

async function hashPassword(plain) {
  const password = String(plain || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${PREFIX}${salt}$${Buffer.from(derived).toString('hex')}`;
}

function isHashedPassword(stored) {
  return String(stored || '').startsWith(PREFIX);
}

async function verifyPassword(plain, stored) {
  const password = String(plain || '');
  const value = String(stored || '');
  if (!value) {
    return false;
  }
  if (!isHashedPassword(value)) {
    return password === value;
  }
  const parts = value.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const salt = parts[1];
  const expectedHex = parts[2];
  const derived = await scrypt(password, salt, 64);
  const actual = Buffer.from(derived);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashedPassword
};
