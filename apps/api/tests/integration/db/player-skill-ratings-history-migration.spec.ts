import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('player_skill_ratings_history migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '028_player_skill_ratings_history.sql'
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

  it('adds updated_by and creates history table', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS updated_by TEXT');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings_history');
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS idx_player_skill_ratings_history_player_assessed'
    );
  });

  it('mirrors history table into tables.sql and deploy.sql', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings_history');
    expect(schema).toContain('updated_by TEXT');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS player_skill_ratings_history');
    expect(deploy).toContain('updated_by TEXT');
  });
});
