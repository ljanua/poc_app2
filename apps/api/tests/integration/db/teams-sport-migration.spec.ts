import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('feature 012 — teams.sport_id migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '016_teams_sport.sql'
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

  it('adds the sport_id column with a RESTRICT FK to sports(id)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id');
    expect(migration).toContain('REFERENCES sports(id) ON DELETE RESTRICT');
  });

  it('backfills every existing team to sport_soccer before locking the column', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    const addIdx = migration.indexOf('ALTER TABLE teams ADD COLUMN');
    const backfillIdx = migration.indexOf("UPDATE teams SET sport_id = 'sport_soccer'");
    const notNullIdx = migration.indexOf('ALTER TABLE teams ALTER COLUMN sport_id SET NOT NULL');

    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(backfillIdx).toBeGreaterThan(addIdx);
    expect(notNullIdx).toBeGreaterThan(backfillIdx);
  });

  it('sets a default of sport_soccer and creates the supporting index', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("ALTER TABLE teams ALTER COLUMN sport_id SET DEFAULT 'sport_soccer'");
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id)');
  });

  it('mirrors sport_id into the canonical teams table definition in tables.sql', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');

    // The CREATE TABLE block for teams must declare sport_id as NOT NULL with
    // a default of sport_soccer and a RESTRICT FK to sports(id).
    expect(schema).toMatch(
      /CREATE TABLE IF NOT EXISTS teams \([\s\S]*?sport_id TEXT NOT NULL DEFAULT 'sport_soccer' REFERENCES sports\(id\) ON DELETE RESTRICT[\s\S]*?\);/
    );
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id)');
  });

  it('mirrors sport_id into deploy.sql so fresh databases pick it up', () => {
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');

    expect(deploy).toMatch(
      /CREATE TABLE IF NOT EXISTS teams \([\s\S]*?sport_id TEXT NOT NULL DEFAULT 'sport_soccer' REFERENCES sports\(id\) ON DELETE RESTRICT[\s\S]*?\);/
    );
    expect(deploy).toContain('CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id)');
  });
});