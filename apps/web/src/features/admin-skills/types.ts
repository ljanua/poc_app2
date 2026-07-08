export type SkillStatus = 'active' | 'inactive';
export type SportStatus = 'active' | 'inactive';
export type PositionStatus = 'active' | 'inactive';

export type Sport = {
  id: string;
  name: string;
  status: SkillStatus;
  positionCount?: number | null;
};

export type Position = {
  id: string;
  name: string;
  sportId: string;
  status: SkillStatus;
  skillCount?: number | null;
};

export type Skill = {
  id: string;
  name: string;
  status: SkillStatus;
  assignedPositionCount?: number | null;
};

export type PositionSkill = {
  positionId: string;
  skillId: string;
  skillName: string;
  status: SkillStatus;
};

export type CreateSportPayload = {
  name: string;
};

export type UpdateSportPayload = {
  name: string;
};

export type SportStatusPayload = {
  status: SkillStatus;
};

export type CreatePositionPayload = {
  name: string;
  sportId: string;
};

export type UpdatePositionPayload = {
  name?: string;
  sportId?: string;
};

export type PositionStatusPayload = {
  status: SkillStatus;
};

export type CreateSkillPayload = {
  name: string;
};

export type UpdateSkillPayload = {
  name: string;
};

export type AssignSkillToPositionPayload = {
  skillId: string;
};