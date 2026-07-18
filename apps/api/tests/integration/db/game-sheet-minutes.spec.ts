import { describe, expect, it } from 'vitest';
import {
  computeMinutesFromSheet,
  validateSheet,
  buildPlayerStatsRollup
} from '../../../../../scripts/game-sheet-minutes.js';

describe('computeMinutesFromSheet', () => {
  it('gives full duration to starters with no subs', () => {
    const result = computeMinutesFromSheet({
      durationMinutes: 90,
      starterIds: ['a', 'b'],
      substitutions: []
    });
    expect(result).toEqual({ a: 90, b: 90 });
  });

  it('splits minutes across a 60th-minute sub', () => {
    const result = computeMinutesFromSheet({
      durationMinutes: 90,
      starterIds: ['a'],
      substitutions: [{ minute: 60, playerOutId: 'a', playerInId: 'b' }]
    });
    expect(result.a).toBe(60);
    expect(result.b).toBe(30);
  });
});

describe('validateSheet', () => {
  it('rejects subbing out a player not on the pitch', () => {
    const result = validateSheet({
      durationMinutes: 90,
      starterIds: ['a'],
      substitutions: [{ minute: 10, playerOutId: 'b', playerInId: 'c' }]
    });
    expect(result.error).toMatch(/not on the pitch/i);
  });
});

describe('buildPlayerStatsRollup', () => {
  it('sums minutes and appearances', () => {
    const rollup = buildPlayerStatsRollup([
      { minutes: 90, rating: 7, kickoffAt: '2026-07-01T12:00:00.000Z' },
      { minutes: 45, rating: 8, kickoffAt: '2026-07-08T12:00:00.000Z' }
    ]);
    expect(rollup.totalMinutes).toBe(135);
    expect(rollup.appearances).toBe(2);
    expect(rollup.lastMatchScore).toBe(8);
    expect(rollup.hasGames).toBe(true);
  });
});
