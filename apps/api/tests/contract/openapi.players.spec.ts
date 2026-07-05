import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const openapi = readFileSync(join(repoRoot, 'openapi', 'v1', 'openapi.yaml'), 'utf8');
const playersSchema = readFileSync(join(repoRoot, 'openapi', 'v1', 'schemas', 'players.yaml'), 'utf8');

describe('OpenAPI players contract', () => {
  it('documents list, create-or-assign, preview, get-by-id and strict move endpoints', () => {
    expect(openapi).toContain('/players/preview-create:');
    expect(openapi).toContain('/players/{playerId}/assign:');
    expect(openapi).toContain('/players/dashboard:');
  });

  it('documents the player profile read and update operations', () => {
    expect(openapi).toContain('/players/{playerId}/profile:');
    // PATCH on /players/{playerId} for full profile update
    expect(openapi).toContain('Update full player profile');
    expect(openapi).toContain('UpdatePlayerProfileRequest');
    expect(openapi).toContain('PlayerProfileResponse');
  });

  it('defines the profile request and response schemas', () => {
    expect(playersSchema).toContain('UpdatePlayerProfileRequest:');
    expect(playersSchema).toContain('PlayerProfileResponse:');
    // Clip counts are coach-editable in the update request
    expect(playersSchema).toMatch(/UpdatePlayerProfileRequest:[\s\S]*clipSubmittedCount/);
    // Documents the missingDataMessage clearing behavior
    expect(playersSchema).toMatch(/clears missingDataMessage/);
  });
});
