import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const openapiText = readFileSync(join(repoRoot, 'openapi', 'v1', 'openapi.yaml'), 'utf8');
const playersSchema = readFileSync(join(repoRoot, 'openapi', 'v1', 'schemas', 'players.yaml'), 'utf8');
const openapiDoc = parseYaml(openapiText) as { paths: Record<string, unknown> };

describe('OpenAPI player skill ratings contract', () => {
  it('defines PlayerSkillRating with nullable 0-100 rating', () => {
    expect(playersSchema).toContain('PlayerSkillRating:');
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?skillId:/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?skillName:/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?positionId:/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?positionName:/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?rating:[\s\S]*?nullable: true/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?rating:[\s\S]*?minimum: 0/);
    expect(playersSchema).toMatch(/PlayerSkillRating:[\s\S]*?rating:[\s\S]*?maximum: 100/);
  });

  it('defines UpdatePlayerSkillRatingsRequest with ratings array', () => {
    expect(playersSchema).toContain('UpdatePlayerSkillRatingsRequest:');
    expect(playersSchema).toMatch(/UpdatePlayerSkillRatingsRequest:[\s\S]*?required: \[ratings\]/);
    expect(playersSchema).toMatch(/UpdatePlayerSkillRatingsRequest:[\s\S]*?skillId:/);
    expect(playersSchema).toMatch(/UpdatePlayerSkillRatingsRequest:[\s\S]*?rating:[\s\S]*?nullable: true/);
  });

  it('defines PlayerSkillRatingsResponse envelope', () => {
    expect(playersSchema).toContain('PlayerSkillRatingsResponse:');
    expect(playersSchema).toMatch(/PlayerSkillRatingsResponse:[\s\S]*?skillRatings:/);
  });

  it('requires skillRatings on dashboard and profile response data', () => {
    const dashboardBlock = playersSchema.split('PlayerDashboardResponse:')[1].split('PlayerProfileResponse:')[0];
    expect(dashboardBlock).toMatch(/required: \[player, stats, metrics, matchTime, performance, clipStats, skillRatings\]/);
    expect(dashboardBlock).toContain('skillRatings:');

    const profileBlock = playersSchema.split('PlayerProfileResponse:')[1].split('UpdatePlayerProfileRequest:')[0];
    expect(profileBlock).toMatch(/required: \[player, stats, skillRatings\]/);
    expect(profileBlock).toContain('skillRatings:');
  });

  it('documents PUT /players/{playerId}/skill-ratings', () => {
    expect(openapiText).toContain('/players/{playerId}/skill-ratings:');
    expect(openapiText).toContain('Update player skill ratings for the current position');
    expect(openapiText).toContain('UpdatePlayerSkillRatingsRequest');
    expect(openapiText).toContain('PlayerSkillRatingsResponse');
  });

  it('documents the skill-out-of-position validation message', () => {
    expect(openapiText).toMatch(/is not tracked for the player's position/);
    expect(openapiText).toContain('Manage Skills (S8)');
  });

  it('registers the path in the parsed OpenAPI document', () => {
    expect(openapiDoc.paths['/players/{playerId}/skill-ratings']).toBeDefined();
    const op = (openapiDoc.paths['/players/{playerId}/skill-ratings'] as { put: { tags: string[] } }).put;
    expect(op.tags).toContain('Players');
  });
});
