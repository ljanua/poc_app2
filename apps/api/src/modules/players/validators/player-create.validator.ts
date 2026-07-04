import { appValidationError } from '../../../shared/errors/app-error';

export type CreatePlayerPayload = {
  name: string;
  teamName: string;
  confirmCreate?: boolean;
};

const NAME_PATTERN = /^[A-Za-z' -]+$/;

export function normalizePlayerName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeComparableName(name: string): string {
  return normalizePlayerName(name).toLowerCase();
}

export function validatePlayerCreateInput(payload: CreatePlayerPayload): void {
  const normalizedName = normalizePlayerName(payload.name);
  const teamName = String(payload.teamName || '').trim();

  if (!teamName || teamName === 'all') {
    throw appValidationError('Pick a team before adding players.');
  }

  if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60 || !NAME_PATTERN.test(normalizedName)) {
    throw appValidationError('Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.');
  }
}
