import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('db bootstrap artifacts', () => {
  it('includes one-shot deploy schema with all canonical tables', () => {
    const deployPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'deploy.sql');
    const deploy = fs.readFileSync(deployPath, 'utf8');

    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS teams');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS players');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS player_team_assignments');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS clips');
    expect(deploy).toContain('CREATE TABLE IF NOT EXISTS player_stats');
  });

  it('includes canonical tables for users, teams, players, assignments, and clips', () => {
    const schemaPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS teams');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS players');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_team_assignments');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS clips');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS player_stats');
  });

  it('includes per-metric change indicator columns on player_stats in both schema files', () => {
    const schemaPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
    const deployPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'deploy.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const deploy = fs.readFileSync(deployPath, 'utf8');

    for (const file of [schema, deploy]) {
      expect(file).toContain('current_level_change_label');
      expect(file).toContain('current_level_change_trend');
      expect(file).toContain('fitness_change_label');
      expect(file).toContain('fitness_change_trend');
      expect(file).toContain('skill_progress_change_label');
      expect(file).toContain('skill_progress_change_trend');
    }
  });

  it('has migration for clips and user status parity', () => {
    const migrationPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations', '007_mockup_clips_and_user_status.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE IF EXISTS users');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS clips');
    expect(migration).toContain('DO $$');
  });

  it('has migration for player stats backfill', () => {
    const migrationPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations', '008_player_stats_source_of_record.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS player_stats');
    expect(migration).toContain('INSERT INTO player_stats');
    expect(migration).toContain('ON CONFLICT (player_id) DO UPDATE');
  });

  it('has an idempotent migration adding metric change indicator columns', () => {
    const migrationPath = path.join(
      process.cwd(),
      'apps',
      'api',
      'src',
      'db',
      'migrations',
      '009_player_stats_metric_change_indicators.sql'
    );
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_level_change_label');
    expect(migration).toContain('ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS fitness_change_label');
    expect(migration).toContain('ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS skill_progress_change_label');
    expect(migration).toContain("WHERE player_id = 'p_10'");
  });
});
