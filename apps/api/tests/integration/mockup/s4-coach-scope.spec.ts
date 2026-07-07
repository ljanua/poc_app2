import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('S4 video capture coach scoping', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S4-video-capture.html'),
    'utf8'
  );

  it('does not call listPlayers without actor scoping params', () => {
    // The bug class: a previous version called MockupApi.listPlayers({ teamName: 'all' })
    // with no actorEmail/onlyMine, which leaked every player to every coach.
    // The fix forwards both params so the backend + offline mirror narrow the
    // result to the actor's clubs.
    expect(source).not.toMatch(/MockupApi\.listPlayers\(\{\s*teamName:\s*'all'\s*\}\)/);

    // The fix calls listPlayers with actorEmail and onlyMine set from page state.
    expect(source).toMatch(/MockupApi\.listPlayers\(\{[\s\S]*?actorEmail:\s*state\.actorEmail[\s\S]*?onlyMine:\s*state\.onlyMine[\s\S]*?\}\)/);
  });

  it('does not hardcode the team dropdown options', () => {
    // The previous markup shipped three literal options (Senior Squad, U19 Prime,
    // U17 Elite). The fix populates the team select dynamically from the actor's
    // available teams so coaches in YMCA Weston don't see VantageIQ Club teams.
    expect(source).not.toMatch(/<option>Team:\s*Senior Squad<\/option>/);
    expect(source).not.toMatch(/<option>Team:\s*U19 Prime<\/option>/);
    expect(source).not.toMatch(/<option>Team:\s*U17 Elite<\/option>/);

    // The fix introduces a populateTeamSelect(...) helper that builds options
    // from the availableTeams array returned by getAvailableTeamsForActor.
    expect(source).toContain('populateTeamSelect');
    expect(source).toContain('getAvailableTeamsForActor');
  });

  it('rewires the player dropdown when the team selection changes', () => {
    // The previous markup only populated players once at page load. The fix
    // attaches a change handler on the team select that calls refreshPlayers().
    expect(source).toMatch(/teamSelect\.addEventListener\(\s*'change'[\s\S]*?refreshPlayers/);
  });

  it('scopes team availability for active Coach actors', () => {
    // getAvailableTeamsForActor must filter by leadCoachEmail/leadCoach match so
    // a coach only sees the teams they lead, mirroring the S1 player-list logic.
    expect(source).toMatch(/getAvailableTeamsForActor[\s\S]*?role\s*===\s*'Coach'[\s\S]*?leadCoachEmail/);
  });
});