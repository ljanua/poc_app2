import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// parseBirthFields / computeAge / birthYearFromAgeGroup live in
// scripts/serve-mockup.js. Source-level assertions pin behavior without a live DB.
describe('parseBirthFields helper', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'serve-mockup.js'),
    'utf8'
  );

  const fnStart = source.indexOf('function parseBirthFields(');
  expect(fnStart, 'parseBirthFields should be defined').toBeGreaterThanOrEqual(0);
  const fnEnd = source.indexOf('\n// Validates and normalizes a PATCH', fnStart);
  const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2500);

  it('returns null/null when both fields are absent or blank', () => {
    expect(body).toMatch(/monthBlank[\s\S]*?yearBlank[\s\S]*?return \{ birthMonth: null, birthYear: null \}/);
    expect(body).toContain('birthMonth: null, birthYear: null');
  });

  it('allows year-only and rejects month-only', () => {
    expect(body).toContain('Birth month cannot be set without a birth year.');
    expect(body).toMatch(/monthBlank[\s\S]*?return \{ birthMonth: null, birthYear: year \}/);
    expect(body).not.toContain('Birth month and year must be set together, or both left blank.');
  });

  it('rejects month out of range (not an integer, or < 1, or > 12)', () => {
    expect(body).toContain('Birth month must be a whole number from 1 (January) to 12 (December).');
    expect(body).toMatch(/month\s+<\s+1\s*\|\|\s*month\s+>\s+12/);
  });

  it('rejects year out of range (< 1960 or > current year)', () => {
    expect(body).toContain('Birth year must be between 1960 and');
    expect(body).toMatch(/year\s+<\s+1960\s*\|\|\s*year\s+>\s*currentYear/);
  });

  it('uses the current calendar year to bound birthYear', () => {
    expect(body).toContain('currentYear = (now instanceof Date ? now : new Date()).getFullYear()');
  });
});

describe('birthYearFromAgeGroup helper', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'serve-mockup.js'),
    'utf8'
  );

  const fnStart = source.indexOf('function birthYearFromAgeGroup(');
  expect(fnStart, 'birthYearFromAgeGroup should be defined').toBeGreaterThanOrEqual(0);
  const fnEnd = source.indexOf('\n// Derives a player', fnStart);
  const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 1500);

  it('strips non-digits and subtracts from the current year', () => {
    expect(body).toMatch(/replace\(\\?\/\\D\/g|replace\(\/\\D\/g/);
    expect(body).toContain('currentYear - ageNumber');
  });

  it('returns null when no digits remain or year is out of bounds', () => {
    expect(body).toContain('return null');
    expect(body).toMatch(/year < 1960 \|\| year > currentYear/);
  });
});

describe('computeAge helper', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'serve-mockup.js'),
    'utf8'
  );

  const fnStart = source.indexOf('function computeAge(');
  expect(fnStart, 'computeAge should be defined').toBeGreaterThanOrEqual(0);
  const fnEnd = source.indexOf('\n// Resolves the active Coach actor', fnStart);
  const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2500);

  it('returns null when birth year is missing', () => {
    expect(body).toMatch(/if \(birthYear == null\)[\s\S]*?return null/);
  });

  it('assumes January (month 1) when month is null for year-only age', () => {
    expect(body).toMatch(/birthMonth == null[\s\S]*?month = 1/);
  });

  it('rejects non-integer months and out-of-range months defensively when month is set', () => {
    expect(body).toMatch(/month\s+<\s+1\s*\|\|\s*month\s+>\s+12/);
  });

  it('subtracts one year when the birthday month has not arrived yet this year', () => {
    expect(body).toContain('referenceMonth');
    expect(body).toMatch(/referenceMonth\s*<\s*month/);
    expect(body).toMatch(/age\s*-=\s*1/);
  });

  it('returns null for future-dated birth years that slipped past validation', () => {
    expect(body).toContain('return age >= 0 ? age : null');
  });

  it('mirrors the same formula via computeAge so server + offline client agree', () => {
    const clientSource = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
      'utf8'
    );
    expect(clientSource).toContain('function computeAge');
    expect(clientSource).toMatch(/birthMonth == null[\s\S]*?month = 1/);
    expect(clientSource).toContain('function birthYearFromAgeGroup');
  });
});

describe('offline parseUpdateProfilePayload birth-error short-circuit', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
    'utf8'
  );

  it('short-circuits with the birth error rather than returning identity with undefined birth fields', () => {
    const fnStart = source.indexOf('function parseUpdateProfilePayload(');
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnEnd = source.indexOf('\n  function ', fnStart + 1);
    const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 4000);
    expect(body).toMatch(/var birth = parseBirthFields\([\s\S]*?\n\s*if \(birth\.error\) \{/);
    expect(body).toContain('return { error: birth.error }');
  });
});
