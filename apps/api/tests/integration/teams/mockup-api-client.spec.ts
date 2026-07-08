import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('mockup-api-client.js — feature 012 teams.sportId', () => {
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );

  function blockAfter(marker, span = 4000) {
    const idx = clientSource.indexOf(marker);
    if (idx < 0) return '';
    return clientSource.slice(idx, idx + span);
  }

  it('createTeam forwards sportId in the backend POST body', () => {
    const block = blockAfter('createTeam(payload, actorRole, actorEmail) {');
    expect(block).toContain('sportId: payload && payload.sportId');
  });

  it('createTeam persists sportId/sportName on the offline-created row', () => {
    const block = blockAfter('createTeam(payload, actorRole, actorEmail) {', 12000);
    expect(block).toContain('resolvedSportId');
    expect(block).toContain("'sport_soccer'");
    expect(block).toMatch(/sportId:\s*resolvedSport \? resolvedSport\.id : 'sport_soccer'/);
    expect(block).toMatch(/sportName:\s*resolvedSport \? resolvedSport\.name : 'Soccer'/);
  });

  it('updateTeamCoachAndClub forwards sportId in the backend POST body', () => {
    const block = blockAfter('updateTeamCoachAndClub(teamId, payload) {');
    expect(block).toContain('sportId: body.sportId');
  });

  it('updateTeamCoachAndClub offline branch assigns sportId/sportName when provided', () => {
    const block = blockAfter('updateTeamCoachAndClub(teamId, payload) {');
    expect(block).toMatch(/team\.sportId = newSport\.id/);
    expect(block).toMatch(/team\.sportName = newSport\.name/);
    expect(block).toContain("The selected sport could not be found.");
  });

  it('listTeamSummary surfaces sportId/sportName on both backend and offline rows', () => {
    const block = blockAfter('listTeamSummary(options) {');
    expect(block).toContain('sportId: team.sportId || null');
    expect(block).toContain('sportName: team.sportName || null');
    // Offline branch
    expect(block).toContain('store.sports || []');
  });

  it('createSeed marks every seeded team with sport_soccer', () => {
    const seedBlock = blockAfter('function createSeed()', 4000);
    const teamsSection = seedBlock.slice(0, seedBlock.indexOf('sports:'));
    const matches = teamsSection.match(/sportId:\s*'sport_soccer'/g);
    expect(matches && matches.length).toBeGreaterThanOrEqual(3);
  });
});