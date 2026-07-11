import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Pure-file assertions: the migration's behavior is exercised end-to-end by
// the live DB connection in scripts/serve-mockup.js and the players-api.spec.ts
// integration suite. This spec locks down the file shape so accidental edits
// (dropping the CHECK, dropping the IF NOT EXISTS, swapping the bound ranges)
// are caught before they hit a running database.
describe('players birth month / year migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '017_players_birth_month_year.sql'
  );

  it('is idempotent (uses ADD COLUMN IF NOT EXISTS)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE players');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS birth_month');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS birth_year');
  });

  it('bounds birth_month to 1-12 with a CHECK constraint', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/birth_month[\s\S]*?BETWEEN 1 AND 12/);
    expect(migration).toContain('CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12)');
  });

  it('bounds birth_year to 1960-current year with a CHECK constraint', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/birth_year[\s\S]*?BETWEEN 1960/);
    expect(migration).toContain(
      "EXTRACT(YEAR FROM NOW())::SMALLINT"
    );
    expect(migration).toMatch(
      /CHECK[\s\S]*?birth_year IS NULL[\s\S]*?BETWEEN 1960[\s\S]*?EXTRACT\(YEAR FROM NOW\(\)\)::SMALLINT/
    );
  });

  it('keeps both columns nullable (the pair is optional on every player)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('birth_month IS NULL');
    expect(migration).toContain('birth_year IS NULL');
    expect(migration).not.toMatch(/birth_month\s+SMALLINT\s+NOT\s+NULL/);
    expect(migration).not.toMatch(/birth_year\s+SMALLINT\s+NOT\s+NULL/);
  });

  it('does not backfill any player rows -- birth data is opt-in via the API', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).not.toContain('UPDATE players');
    expect(migration).not.toContain('INSERT INTO players');
  });
});

describe('players birth_year backfill from age_group migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '022_backfill_player_birth_year_from_age_group.sql'
  );

  it('overwrites birth_year from team age_group digits', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('UPDATE players');
    expect(migration).toContain('regexp_replace(t.age_group');
    expect(migration).toContain('EXTRACT(YEAR FROM NOW())');
    expect(migration).toContain('player_team_assignments');
  });

  it('does not modify birth_month', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).not.toMatch(/SET[\s\S]*birth_month\s*=/);
  });

  it('skips age groups with no digits', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toMatch(/regexp_replace\(t\.age_group[\s\S]*?<> ''/);
  });
});
