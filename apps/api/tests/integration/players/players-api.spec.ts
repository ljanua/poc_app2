import { describe, expect, it } from 'vitest';
import { PlayersController } from '../../../src/modules/players/controllers/players.controller';

describe('players api scaffold', () => {
  it('supports create, list by team, and assign flow contract behavior', () => {
    const controller = new PlayersController();

    const created = controller.create({
      teamName: 'U19 Prime',
      name: 'Lamine Yamal',
      confirmCreate: true
    });

    const listed = controller.list({ teamName: 'U19 Prime' });
    const assigned = controller.assign(created.player.id, { teamName: 'Senior Squad' });

    expect(created.status).toBe(201);
    expect(listed.data.some((item) => item.name === 'Lamine Yamal')).toBe(true);
    expect(assigned.status).toBe(200);
    expect(assigned.player.teamName).toBe('Senior Squad');
  });

  it('returns validation error for no-match create without explicit confirmation', () => {
    const controller = new PlayersController();

    expect(() =>
      controller.create({
        teamName: 'U19 Prime',
        name: 'Arda Guler',
        confirmCreate: false
      })
    ).toThrow('Explicit confirmation is required to create this player.');
  });
});
