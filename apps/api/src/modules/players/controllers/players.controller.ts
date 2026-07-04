import { PlayersService } from '../services/players.service';
import type { CreatePlayerPayload } from '../validators/player-create.validator';

export class PlayersController {
  constructor(private readonly service = new PlayersService()) {}

  list(query: { teamName?: string; query?: string }) {
    return { data: this.service.listPlayers(query) };
  }

  create(body: CreatePlayerPayload) {
    return this.service.createOrAssign(body);
  }

  assign(playerId: number, body: { teamName: string }) {
    return this.service.assignExistingPlayer(playerId, body.teamName);
  }

  getById(playerId: number) {
    return { data: this.service.getPlayer(playerId) };
  }

  preview(body: { name: string; teamName: string }) {
    return { data: this.service.previewCreate(body) };
  }
}
