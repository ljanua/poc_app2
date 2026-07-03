import { setWorldConstructor, World } from '@cucumber/cucumber';

type Role = 'SystemAdmin' | 'Coach';
type Status = 'active' | 'inactive';

type User = {
  name: string;
  email: string;
  role: Role;
  status: Status;
  password: string;
};

export class BddWorld extends World {
  users = new Map<string, User>();
  actorRole: Role | null = null;
  activeToken: string | null = null;
  tokenExpired = false;

  lastStatus = 0;
  lastResponseUser: User | null = null;
  lastErrorCode: 'validation_error' | 'forbidden' | 'not_found' | 'conflict' | 'unknown' | null = null;
  lastErrorMessage: string | null = null;

  resetResponse(): void {
    this.lastStatus = 0;
    this.lastResponseUser = null;
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
  }
}

setWorldConstructor(BddWorld);
