import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('skills / positions / sports migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '015_skills_positions_sports.sql'
  );
  const tablesSqlPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'schema',
    'tables.sql'
  );
  const deploySqlPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'schema',
    'deploy.sql'
  );

  it('creates the four tables idempotently', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS sports');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS positions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS skills');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS position_skills');
  });

  it('reuses the standard status CHECK / DEFAULT pattern for soft-disable', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    // All three flag-bearers (sports, positions, skills) carry the same status
    // CHECK pattern used by users, teams, and clubs.
    expect(migration.match(/status TEXT NOT NULL DEFAULT 'active'/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(migration.match(/CHECK \(status IN \('active', 'inactive'\)\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('uses ON DELETE RESTRICT for the position_skills join', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('REFERENCES positions(id) ON DELETE RESTRICT');
    expect(migration).toContain('REFERENCES skills(id) ON DELETE RESTRICT');
  });

  it('creates the supporting (status, name) indexes for filter queries', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_sports_status_name');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_positions_status_name');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_skills_status_name');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_position_skills_skill_id');
  });

  it('seeds the Soccer catalog idempotently (1 sport, 13 positions, 31 skills incl. Heading, 65 assignments)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("INSERT INTO sports (id, name, status)");
    expect(migration).toContain("('sport_soccer', 'Soccer', 'active')");
    expect(migration).toContain('ON CONFLICT (name) DO NOTHING');
    expect(migration).toContain('ON CONFLICT (sport_id, name) DO NOTHING');
    expect(migration).toContain('ON CONFLICT (position_id, skill_id) DO NOTHING');

    // 13 position seeds.
    expect(migration.match(/INSERT INTO positions \(id, name, sport_id, status\)[\s\S]*?VALUES/g)?.length ?? 0).toBe(1);

    // 65 position_skill rows are inserted as a single INSERT ... VALUES block.
    expect(migration).toContain("INSERT INTO position_skills (position_id, skill_id)");
  });

  it('mirrors the four CREATE TABLE blocks into tables.sql', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS sports');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS positions');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS skills');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS position_skills');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_position_skills_skill_id');
  });

  it('mirrors the four CREATE TABLE blocks into deploy.sql so fresh DBs pick them up', () => {
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');

    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS sports');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS positions');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS skills');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS position_skills');
  });
});