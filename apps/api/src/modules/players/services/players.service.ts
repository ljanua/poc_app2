import { appNotFoundError, appValidationError } from '../../../shared/errors/app-error';
import { PlayerRepository, type PlayerRecord } from '../repositories/player-repository';
import {
  normalizeComparableName,
  normalizePlayerName,
  validatePlayerCreateInput,
  type CreatePlayerPayload
} from '../validators/player-create.validator';

type CreatePlayerResult =
  | { status: 201; code: 'created'; player: PlayerRecord; message: string }
  | { status: 200; code: 'ok'; moved: boolean; player: PlayerRecord; message: string }
  | { status: 409; code: 'conflict'; message: string; duplicatePlayer: PlayerRecord };

export class PlayersService {
  constructor(private readonly repository = new PlayerRepository()) {}

  listPlayers(filters: { teamName?: string; query?: string }) {
    return this.repository.list(filters.teamName, filters.query);
  }

  previewCreate(payload: Pick<CreatePlayerPayload, 'name' | 'teamName'>) {
    validatePlayerCreateInput({ name: payload.name, teamName: payload.teamName });
    const normalizedName = normalizePlayerName(payload.name);
    const comparable = normalizeComparableName(payload.name);
    const duplicatePlayer = this.repository.findByNormalizedName(comparable);

    return {
      normalizedName,
      teamName: payload.teamName,
      duplicatePlayer
    };
  }

  createOrAssign(payload: CreatePlayerPayload): CreatePlayerResult {
    validatePlayerCreateInput(payload);

    const normalizedName = normalizePlayerName(payload.name);
    const comparable = normalizeComparableName(payload.name);
    const teamName = String(payload.teamName).trim();

    const existing = this.repository.findByNormalizedName(comparable);
    if (existing) {
      if (existing.name.toLowerCase() === normalizedName.toLowerCase()) {
        const moveResult = this.repository.assignToTeam(existing.id, teamName);
        return {
          status: 200,
          code: 'ok',
          moved: moveResult.moved,
          player: moveResult.player,
          message: moveResult.moved
            ? `${moveResult.player.name} moved to ${teamName}.`
            : 'Player is already assigned to this team.'
        };
      }

      return {
        status: 409,
        code: 'conflict',
        message: 'A user with the same identifier already exists.',
        duplicatePlayer: existing
      };
    }

    if (!payload.confirmCreate) {
      throw appValidationError('Explicit confirmation is required to create this player.');
    }

    const created = this.repository.create({
      name: normalizedName,
      normalizedName: comparable,
      teamName,
      position: 'Position not set',
      trend: 'plateau'
    });

    return {
      status: 201,
      code: 'created',
      player: created,
      message: `${created.name} created and assigned to ${teamName}.`
    };
  }

  assignExistingPlayer(playerId: number, teamName: string) {
    if (!teamName || teamName === 'all') {
      throw appValidationError('Pick a team before adding players.');
    }

    const moveResult = this.repository.assignToTeam(playerId, teamName);
    return {
      status: 200 as const,
      code: 'ok' as const,
      moved: moveResult.moved,
      player: moveResult.player,
      message: moveResult.moved
        ? `${moveResult.player.name} moved to ${teamName}.`
        : 'Player is already assigned to this team.'
    };
  }

  getPlayer(playerId: number): PlayerRecord {
    const player = this.repository.findById(playerId);
    if (!player) {
      throw appNotFoundError('The selected player was not found anymore. Refresh and try again.');
    }
    return player;
  }
}
