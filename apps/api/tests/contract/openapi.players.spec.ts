import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const openapiText = readFileSync(join(repoRoot, 'openapi', 'v1', 'openapi.yaml'), 'utf8');
const playersSchema = readFileSync(join(repoRoot, 'openapi', 'v1', 'schemas', 'players.yaml'), 'utf8');
const openapiDoc = parseYaml(openapiText) as { paths: Record<string, unknown> };

describe('OpenAPI players contract', () => {
  it('documents list, create-or-assign, preview, get-by-id and strict move endpoints', () => {
    expect(openapiText).toContain('/players/preview-create:');
    expect(openapiText).toContain('/players/{playerId}/assign:');
    expect(openapiText).toContain('/players/dashboard:');
  });

  it('documents the player profile read and update operations', () => {
    expect(openapiText).toContain('/players/{playerId}/profile:');
    // PATCH on /players/{playerId} for full profile update
    expect(openapiText).toContain('Update full player profile');
    expect(openapiText).toContain('UpdatePlayerProfileRequest');
    expect(openapiText).toContain('PlayerProfileResponse');
  });

  it('defines the profile request and response schemas', () => {
    expect(playersSchema).toContain('UpdatePlayerProfileRequest:');
    expect(playersSchema).toContain('PlayerProfileResponse:');
    // Clip counts are coach-editable in the update request
    expect(playersSchema).toMatch(/UpdatePlayerProfileRequest:[\s\S]*clipSubmittedCount/);
    // Documents the missingDataMessage clearing behavior
    expect(playersSchema).toMatch(/clears missingDataMessage/);
  });

  it('declares actorEmail and onlyMine query parameters on GET /players', () => {
    const listOperation = (openapiDoc.paths['/players'] as { get: { parameters: Array<{ name: string; in: string; schema?: { type?: string } }> } }).get;
    const params = listOperation.parameters;
    const actorEmailParam = params.find((p) => p.name === 'actorEmail' && p.in === 'query');
    const onlyMineParam = params.find((p) => p.name === 'onlyMine' && p.in === 'query');
    expect(actorEmailParam).toBeDefined();
    expect(actorEmailParam?.schema?.type).toBe('string');
    expect(onlyMineParam).toBeDefined();
    expect(onlyMineParam?.schema?.type).toBe('boolean');
  });

  it('documents the coach-scoping behavior in the GET /players description', () => {
    const listOperation = (openapiDoc.paths['/players'] as { get: { description: string } }).get;
    expect(listOperation.description).toMatch(/Coach/);
    expect(listOperation.description).toMatch(/coach_clubs/);
    expect(listOperation.description).toMatch(/SystemAdmin/);
  });

  it('exposes birthMonth / birthYear on Player and a readOnly derived age', () => {
    // Player carries the persisted pair and the derived age.
    expect(playersSchema).toMatch(/Player:[\s\S]*birthMonth:[\s\S]*nullable: true/);
    expect(playersSchema).toMatch(/Player:[\s\S]*birthYear:[\s\S]*nullable: true/);
    expect(playersSchema).toMatch(/age:[\s\S]*readOnly: true/);

    // The pair is optional on Player -- not part of the required list. Scope the
    // negative check to the Player schema block so a later schema's required
    // list doesn't accidentally satisfy it.
    const playerBlock = playersSchema.split('Player:')[1].split('PlayerResponse:')[0];
    expect(playerBlock).toMatch(/required: \[id, name, normalizedName, teamName, position, trend, updated\]/);
    expect(playerBlock).not.toMatch(/required: \[[^\]]*birthMonth/);
    expect(playerBlock).not.toMatch(/required: \[[^\]]*birthYear/);

    // Bounds match the migration's CHECK constraints.
    expect(playersSchema).toMatch(/birthMonth:[\s\S]*minimum: 1/);
    expect(playersSchema).toMatch(/birthMonth:[\s\S]*maximum: 12/);
    expect(playersSchema).toMatch(/birthYear:[\s\S]*minimum: 1960/);
  });

  it('exposes birthMonth / birthYear on both create and update requests', () => {
    expect(playersSchema).toMatch(/CreatePlayerRequest:[\s\S]*birthMonth:[\s\S]*nullable: true/);
    expect(playersSchema).toMatch(/CreatePlayerRequest:[\s\S]*birthYear:[\s\S]*nullable: true/);
    expect(playersSchema).toMatch(/UpdatePlayerProfileRequest:[\s\S]*birthMonth:[\s\S]*nullable: true/);
    expect(playersSchema).toMatch(/UpdatePlayerProfileRequest:[\s\S]*birthYear:[\s\S]*nullable: true/);

    // The pair must not be required on either request -- both are optional
    // inputs that the server validates together. Use a function to scope each
    // check to just the relevant schema block so a later schema's required
    // list doesn't accidentally satisfy the negative assertion.
    const createBlock = playersSchema.split('CreatePlayerRequest:')[1].split('UpdatePlayerProfileRequest:')[0];
    const updateBlock = playersSchema.split('UpdatePlayerProfileRequest:')[1].split('PlayerDashboardStats:')[0];
    expect(createBlock).toMatch(/required: \[name, teamName\]/);
    expect(updateBlock).toMatch(/required: \[name, teamName, position, trend\]/);
    expect(createBlock).not.toMatch(/required: \[[^\]]*birthMonth/);
    expect(createBlock).not.toMatch(/required: \[[^\]]*birthYear/);
    expect(updateBlock).not.toMatch(/required: \[[^\]]*birthMonth/);
    expect(updateBlock).not.toMatch(/required: \[[^\]]*birthYear/);
  });

  it('documents that the server rejects partial birth-date pairs', () => {
    // Either request schema's description text must warn about the strict pair rule.
    const block = playersSchema.split('CreatePlayerRequest:')[1] || '';
    expect(block).toMatch(/Birth month and year must be set together|Must be paired|partial pairs|Send together|set together/i);
    const updateBlock = playersSchema.split('UpdatePlayerProfileRequest:')[1] || '';
    expect(updateBlock).toMatch(/Birth month and year must be set together|Must be paired|partial pairs|Send together|set together/i);
  });
});

describe('Player-club invariant', () => {
  // The invariant "every player has a club" is enforced structurally:
  // a player is created by POST /v1/players with a teamName, and team-create
  // requires a non-empty clubId. This test locks the server-side enforcement
  // so a future refactor cannot silently relax it (e.g. by allowing team-create
  // without a club). The OpenAPI Team schema keeps clubId as an optional
  // response field because stale rows in degenerate read paths may report
  // null; the create-time contract is what locks the invariant.
  it('serves the player-club invariant by rejecting team-create without a clubId', () => {
    const serveMockupText = readFileSync(join(repoRoot, 'scripts', 'serve-mockup.js'), 'utf8');
    // POST /v1/teams handler must guard against missing/empty clubId.
    expect(serveMockupText).toMatch(/Please select a club for this team\./);
    // The fallback for Coach without a club must use coach_clubs, not skip the rule.
    expect(serveMockupText).toMatch(/SELECT club_id FROM coach_clubs WHERE user_id = \$1/);
  });
});
