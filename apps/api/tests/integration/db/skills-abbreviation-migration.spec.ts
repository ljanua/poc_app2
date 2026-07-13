import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  suggestSkillAbbreviation,
  normalizeSkillAbbreviation,
  validateSkillAbbreviation
} = require('../../../../../scripts/skills/suggest-abbreviation.js');

describe('skill abbreviation suggest helper (Feature 037)', () => {
  it('applies the five fixed catalog overrides', () => {
    expect(suggestSkillAbbreviation('Ball Control')).toBe('BCN');
    expect(suggestSkillAbbreviation('Fitness')).toBe('FIT');
    expect(suggestSkillAbbreviation('Game Awareness')).toBe('AWR');
    expect(suggestSkillAbbreviation('Passing')).toBe('PAS');
    expect(suggestSkillAbbreviation('Speed')).toBe('SPD');
  });

  it('suggests multi-word and single-word codes', () => {
    expect(suggestSkillAbbreviation('Long shots')).toBe('LSH');
    expect(suggestSkillAbbreviation('Pace')).toBe('PAC');
  });

  it('normalizes and validates abbreviations', () => {
    expect(normalizeSkillAbbreviation(' pas ', 'Passing')).toBe('PAS');
    expect(normalizeSkillAbbreviation('', 'Passing')).toBe('PAS');
    expect(validateSkillAbbreviation('')).toMatch(/1-3/);
    expect(validateSkillAbbreviation('TOOLONG')).toMatch(/1-3/);
    expect(validateSkillAbbreviation('PAS')).toBeNull();
  });
});

describe('skill abbreviation migration artifacts (Feature 037)', () => {
  const migrationPath = path.join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'db',
    'migrations',
    '025_skill_abbreviation.sql'
  );
  const tablesSqlPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'tables.sql');
  const deploySqlPath = path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'schema', 'deploy.sql');
  const serveMockupPath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');

  it('adds abbreviation with length check and backfill overrides', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS abbreviation');
    expect(migration).toContain("abbreviation = 'BCN'");
    expect(migration).toContain("abbreviation = 'FIT'");
    expect(migration).toContain("abbreviation = 'AWR'");
    expect(migration).toContain("abbreviation = 'PAS'");
    expect(migration).toContain("abbreviation = 'SPD'");
    expect(migration).toContain('skills_abbreviation_len_check');
    expect(migration).toContain('ALTER COLUMN abbreviation SET NOT NULL');
  });

  it('mirrors into tables.sql, deploy.sql, and ensureDatabase', () => {
    const schema = fs.readFileSync(tablesSqlPath, 'utf8');
    const deploy = fs.readFileSync(deploySqlPath, 'utf8');
    const serve = fs.readFileSync(serveMockupPath, 'utf8');
    expect(schema).toMatch(/abbreviation TEXT NOT NULL/);
    expect(deploy).toMatch(/abbreviation/);
    expect(serve).toContain('suggestSkillAbbreviation');
    expect(serve).toContain('ALTER TABLE skills ADD COLUMN IF NOT EXISTS abbreviation');
    expect(serve).toContain('normalizeSkillAbbreviation');
  });
});
