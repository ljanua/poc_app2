'use strict';

const {
  parseMmSs,
  resolveDurationSeconds,
  validateDurationSeconds,
  shouldApplyMaxFpsFilter,
  DEFAULT_DURATION_SEC,
  MAX_DURATION_SEC
} = require('./link-ingest');
const { SEGMENT_SECONDS, MAX_SEGMENTS } = require('./ffmpeg-utils');
const { parseMatchResponse } = require('./find-player');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert(SEGMENT_SECONDS === 10, 'segment length 10s');
assert(MAX_SEGMENTS === 3, 'max 3 segments');
assert(MAX_DURATION_SEC === SEGMENT_SECONDS * MAX_SEGMENTS, 'max duration = 30s');
assert(DEFAULT_DURATION_SEC === MAX_DURATION_SEC, 'default duration is max window');

assert(parseMmSs('01:30') === 90, 'parse 01:30');
assert(parseMmSs('00:00') === 0, 'parse 00:00');
assert(parseMmSs('2:00') === 120, 'parse 2:00');
assert(parseMmSs('02:01') === 121, 'parse 02:01');
assert(parseMmSs('bad') === null, 'reject bad');
assert(parseMmSs('1:60') === null, 'reject invalid seconds');

assert(resolveDurationSeconds('') === DEFAULT_DURATION_SEC, 'default duration');
assert(resolveDurationSeconds('00:30') === MAX_DURATION_SEC, 'max duration');
assert(resolveDurationSeconds('00:15') === 15, 'fifteen seconds');
assert(resolveDurationSeconds('00:31') === null, 'over max rejected');
assert(resolveDurationSeconds('01:00') === null, 'one minute over max');
assert(validateDurationSeconds(0) === false, 'zero invalid');
assert(validateDurationSeconds(1) === true, 'one second ok');
assert(validateDurationSeconds(30) === true, 'thirty seconds ok');
assert(validateDurationSeconds(31) === false, 'thirty-one invalid');

assert(shouldApplyMaxFpsFilter(60, 30) === true, 'cap 60fps');
assert(shouldApplyMaxFpsFilter(30, 30) === false, 'keep 30fps');
assert(shouldApplyMaxFpsFilter(24, 30) === false, 'keep 24fps');
assert(shouldApplyMaxFpsFilter(null, 30) === true, 'unknown fps apply cap');

assert(parseMatchResponse('{"match":true}') === true, 'json match true');
assert(parseMatchResponse('{"match":false}') === false, 'json match false');
assert(parseMatchResponse('yes the player is there') === true, 'yes text');
assert(parseMatchResponse('no match found') === false, 'no match text');

console.log('link-ingest / find-player helpers: ok');
