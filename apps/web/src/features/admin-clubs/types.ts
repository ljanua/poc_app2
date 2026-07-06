export type ClubStatus = 'active' | 'inactive';

export type Club = {
  id: string;
  name: string;
  status: ClubStatus;
  coachCount?: number | null;
  teamCount?: number | null;
};

export type ClubMembership = {
  userId: string;
  clubId: string;
  clubName: string;
  status: ClubStatus;
};

export type CreateClubPayload = {
  name: string;
};

export type UpdateClubPayload = {
  name: string;
};

export type ClubStatusPayload = {
  status: ClubStatus;
};

export type AssignUserClubPayload = {
  userId: string;
  clubId: string;
};

export type RemoveUserClubParams = {
  userId: string;
  clubId: string;
};

export type AssignTeamToClubPayload = {
  teamId: string;
};