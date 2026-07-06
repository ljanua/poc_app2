import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('clubs.status migration artifacts', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '014_clubs_status.sql'
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

  it('adds clubs.status idempotently with the same check/default as teams.status', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE clubs');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    expect(migration).toContain("CHECK (status IN ('active', 'inactive'))");
  });

  it('creates a supporting (status, name) index to cover S7a filter queries', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_clubs_status_name');
    expect(migration).toContain('ON clubs(status, name)');
  });

  it('mirrors clubs.status into the canonical tables.sql source of record', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS clubs');
    expect(schema).toMatch(/clubs\s*\([\s\S]*?status TEXT NOT NULL DEFAULT 'active'/);
    expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_clubs_status_name ON clubs(status, name)');
  });

  it('mirrors clubs.status into the idempotent deploy.sql so fresh DBs pick it up', () => {
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');

    expect(deploy).toMatch(/clubs\s*\([\s\S]*?status TEXT NOT NULL DEFAULT 'active'/);
    expect(deploy).toContain('CREATE INDEX IF NOT EXISTS idx_clubs_status_name ON clubs(status, name)');
  });
});