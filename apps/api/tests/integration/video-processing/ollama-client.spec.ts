import { describe, expect, it } from 'vitest';

describe('video-processing ollama-client', () => {
  it('parses comments from valid JSON alongside ratings', async () => {
    const { parseRatingsFromResponse } = await import(
      '../../../../../scripts/video-processing/ollama-client.js'
    );
    const content = JSON.stringify({
      ratings: [{ skill: 'Technical Skill', rating: 0.82 }],
      comments: 'Strong passing weight and accuracy.'
    });
    const result = parseRatingsFromResponse(content, ['Technical Skill']);
    expect(result.ratings).toEqual({ 'Technical Skill': 0.82 });
    expect(result.comments).toBe('Strong passing weight and accuracy.');
  });

  it('returns empty comments when the key is missing', async () => {
    const { parseRatingsFromResponse } = await import(
      '../../../../../scripts/video-processing/ollama-client.js'
    );
    const content = JSON.stringify({
      ratings: [{ skill: 'Pace', rating: 0.7 }]
    });
    const result = parseRatingsFromResponse(content, ['Pace']);
    expect(result.ratings).toEqual({ Pace: 0.7 });
    expect(result.comments).toBe('');
  });

  it('falls back to legacy summary as comments', async () => {
    const { parseRatingsFromResponse } = await import(
      '../../../../../scripts/video-processing/ollama-client.js'
    );
    const content = JSON.stringify({
      ratings: [{ skill: 'Finishing', rating: 0.6 }],
      summary: 'Good composure in front of goal.'
    });
    const result = parseRatingsFromResponse(content, ['Finishing']);
    expect(result.comments).toBe('Good composure in front of goal.');
  });

  it('buildAssessmentPrompt requests comments in the JSON shape', async () => {
    const { buildAssessmentPrompt } = await import(
      '../../../../../scripts/video-processing/ollama-client.js'
    );
    const prompt = buildAssessmentPrompt({
      sportType: 'Soccer',
      situation: 'Penalty kick',
      ageOfPlayer: 12,
      skillFocusList: ['Finishing']
    });
    expect(prompt).toContain('comments');
    expect(prompt).toContain('observed in the video');
    expect(prompt).not.toContain('"summary"');
  });
});
