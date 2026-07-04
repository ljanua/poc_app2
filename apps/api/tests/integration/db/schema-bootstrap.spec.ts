import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('db bootstrap artifacts', () => {
  it('includes canonical tables for users, teams, players, assignments, and clips', () => {
    const schemaPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS teams');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS players');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_team_assignments');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS clips');
  });

  it('has migration for clips and user status parity', () => {
    const migrationPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations', '007_mockup_clips_and_user_status.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE IF EXISTS users');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS clips');
  });
});
