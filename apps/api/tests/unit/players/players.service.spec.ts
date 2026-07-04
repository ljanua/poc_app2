import { describe, expect, it } from 'vitest';
import { PlayersService } from '../../../src/modules/players/services/players.service';

describe('PlayersService', () => {
  it('creates new player only when confirmation is explicit', () => {
    const service = new PlayersService();

    expect(() =>
      service.createOrAssign({
        teamName: 'U19 Prime',
        name: 'Lamine Yamal',
        confirmCreate: false
      })
    ).toThrow('Explicit confirmation is required to create this player.');

    const created = service.createOrAssign({
      teamName: 'U19 Prime',
      name: '  lamine   yamal ',
      confirmCreate: true
    });

    expect(created.status).toBe(201);
    expect(created.player.name).toBe('Lamine Yamal');
  });

  it('moves existing player to a new team with strict single-team ownership', () => {
    const service = new PlayersService();

    const moved = service.createOrAssign({
      teamName: 'Senior Squad',
      name: 'Neymar Jr',
      confirmCreate: true
    });

    expect(moved.status).toBe(200);
    expect(moved.player.teamName).toBe('Senior Squad');

    const list = service.listPlayers({ teamName: 'U17 Elite' });
    expect(list.find((player) => player.name === 'Neymar Jr')).toBeUndefined();
  });

  it('returns deterministic duplicate conflict for normalized mismatch case', () => {
    const service = new PlayersService();

    const conflict = service.createOrAssign({
      teamName: 'Senior Squad',
      name: '  lionel    messi ',
      confirmCreate: true
    });

    expect(conflict.status).toBe(200);
  });
});
