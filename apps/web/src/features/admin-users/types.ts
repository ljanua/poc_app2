export type UserRole = 'SystemAdmin' | 'Coach';
export type UserStatus = 'active' | 'inactive';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  clubIds?: string[];
};

export type CreateUserPayload = {
  name: string;
  email: string;
  role: UserRole;
  initialPassword: string;
};

export type ChangeRolePayload = {
  userId: string;
  role: UserRole;
};

export type ChangePasswordPayload = {
  userId: string;
  newPassword: string;
  confirmPassword: string;
};
