export type AdminActorRole = 'SystemAdmin' | 'Coach';

export function canAccessAdminSkills(actorRole: AdminActorRole): boolean {
  return actorRole === 'SystemAdmin';
}