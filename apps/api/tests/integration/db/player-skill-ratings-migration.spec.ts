import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('player_skill_ratings migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '018_player_skill_ratings.sql'
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

  it('creates the table idempotently', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_skill_id');
  });

  it('references players ON DELETE CASCADE and skills ON DELETE RESTRICT', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('REFERENCES players(id) ON DELETE CASCADE');
    expect(migration).toContain('REFERENCES skills(id) ON DELETE RESTRICT');
  });

  it('bounds rating to 0-100 with NULL allowed', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain(
      'CHECK (rating IS NULL OR (rating BETWEEN 0 AND 100))'
    );
  });

  it('uses composite PK (player_id, skill_id)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('PRIMARY KEY (player_id, skill_id)');
  });

  it('does not seed any rating rows', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).not.toContain('INSERT INTO player_skill_ratings');
  });

  it('mirrors the CREATE TABLE block into tables.sql', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings');
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_skill_id');
    expect(schema).toContain('CHECK (rating IS NULL OR (rating BETWEEN 0 AND 100))');
  });

  it('mirrors the CREATE TABLE block into deploy.sql so fresh DBs pick it up', () => {
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');

    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings');
    expect(deploy).toContain('CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_skill_id');
  });
});
