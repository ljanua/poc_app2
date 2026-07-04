import { appNotFoundError } from '../../../shared/errors/app-error';

export type PlayerTrend = 'improving' | 'plateau' | 'declining';

export type PlayerRecord = {
  id: number;
  name: string;
  normalizedName: string;
  teamName: string;
  position: string;
  trend: PlayerTrend;
  updated: string;
};

const seedPlayers: PlayerRecord[] = [
  {
    id: 10,
    name: 'Lionel Messi',
    normalizedName: 'lionel messi',
    teamName: 'U19 Prime',
    position: 'Forward - Left Wing',
    trend: 'improving',
    updated: 'Updated 2h ago'
  },
  {
    id: 11,
    name: 'Cristiano Ronaldo',
    normalizedName: 'cristiano ronaldo',
    teamName: 'Senior Squad',
    position: 'Forward - Center Forward',
    trend: 'plateau',
    updated: 'Updated 5h ago'
  },
  {
    id: 12,
    name: 'Neymar Jr',
    normalizedName: 'neymar jr',
    teamName: 'U17 Elite',
    position: 'Forward - Right Wing',
    trend: 'declining',
    updated: 'Updated 1d ago'
  }
];

export class PlayerRepository {
  private readonly data = new Map<number, PlayerRecord>();
  private nextId = 13;

  constructor(initialData: PlayerRecord[] = seedPlayers) {
    for (const player of initialData) {
      this.data.set(player.id, { ...player });
      this.nextId = Math.max(this.nextId, player.id + 1);
    }
  }

  list(teamName?: string, query?: string): PlayerRecord[] {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    const normalizedTeam = String(teamName || 'all').trim();

    return Array.from(this.data.values()).filter((player) => {
      const teamMatches = normalizedTeam === 'all' || player.teamName === normalizedTeam;
      const queryMatches =
        !normalizedQuery ||
        player.name.toLowerCase().includes(normalizedQuery) ||
        player.position.toLowerCase().includes(normalizedQuery);
      return teamMatches && queryMatches;
    });
  }

  findByNormalizedName(normalizedName: string): PlayerRecord | null {
    return Array.from(this.data.values()).find((entry) => entry.normalizedName === normalizedName) ?? null;
  }

  findById(playerId: number): PlayerRecord | null {
    return this.data.get(playerId) ?? null;
  }

  create(input: Omit<PlayerRecord, 'id' | 'updated'>): PlayerRecord {
    const created: PlayerRecord = {
      ...input,
      id: this.nextId++,
      updated: 'Updated just now'
    };

    this.data.set(created.id, created);
    return created;
  }

  assignToTeam(playerId: number, teamName: string): { player: PlayerRecord; moved: boolean } {
    const existing = this.findById(playerId);
    if (!existing) {
      throw appNotFoundError('The selected player was not found anymore. Refresh and try again.');
    }

    if (existing.teamName === teamName) {
      return { player: existing, moved: false };
    }

    const updated: PlayerRecord = {
      ...existing,
      teamName,
      updated: 'Updated just now'
    };
    this.data.set(updated.id, updated);
    return { player: updated, moved: true };
  }
}
