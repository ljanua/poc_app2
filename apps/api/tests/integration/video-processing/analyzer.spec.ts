import { describe, expect, it } from 'vitest';
import {
  shouldStopAssessing,
  mergeSegmentRatings,
  computeOverallScore
} from '../../../../../scripts/video-processing/analyzer.js';

describe('video-processing analyzer', () => {
  it('stops after majority of skills are rated', () => {
    const skills = ['Passing', 'Finishing', 'Pace'];
    const ratings = { Passing: 0.8, Finishing: 0.7, Pace: 0.6 };
    expect(shouldStopAssessing(skills, ratings, 0)).toBe(true);
  });

  it('stops after second segment when half the skills are rated', () => {
    const skills = ['Passing', 'Finishing', 'Pace', 'Positioning'];
    const ratings = { Passing: 0.8, Finishing: 0.7 };
    expect(shouldStopAssessing(skills, ratings, 0)).toBe(false);
    expect(shouldStopAssessing(skills, ratings, 1)).toBe(true);
  });

  it('merges segment ratings without overwriting existing values', () => {
    const merged = mergeSegmentRatings({ Passing: 0.7 }, { Passing: 0.2, Finishing: 0.8 });
    expect(merged).toEqual({ Passing: 0.7, Finishing: 0.8 });
  });

  it('computes an average overall score', () => {
    expect(computeOverallScore({ Passing: 0.8, Finishing: 0.6 })).toBe(0.7);
  });
});
