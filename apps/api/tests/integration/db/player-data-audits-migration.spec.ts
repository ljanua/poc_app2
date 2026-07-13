import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('player_data_audits migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '024_player_data_audits.sql'
  );
  const tablesSqlPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
  const deploySqlPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'deploy.sql');
  const serveMockupPath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');

  it('creates the table idempotently with required columns', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS player_data_audits');
    expect(migration).toContain("entity IN ('profile', 'team_assignment', 'skill_rating')");
    expect(migration).toContain("actor_kind IN ('user', 'system')");
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_player_data_audits_player_created');
  });

  it('allows nullable actor_user_id for system rows', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toMatch(/actor_user_id TEXT REFERENCES users\(id\) ON DELETE SET NULL/);
  });

  it('mirrors into tables.sql, deploy.sql, and ensureDatabase', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');
    const serve = fs.readFileSync(serveMockupPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_data_audits');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS player_data_audits');
    expect(serve).toContain('CREATE TABLE IF NOT EXISTS player_data_audits');
  });
});
