import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('games and game_performance migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '029_games_and_game_performance.sql'
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

  it('creates games, substitutions, and game_performance', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS games');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS game_substitutions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS game_performance');
  });

  it('mirrors into tables.sql and deploy.sql', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS games');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS game_performance');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS games');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS game_performance');
  });
});
