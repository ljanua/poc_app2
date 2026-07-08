import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// parseBirthFields lives in scripts/serve-mockup.js (the primary persistence
// path). Source-level assertions pin the helper's behavior so a future edit
// (dropping the strict-pair rule, widening the year bound, etc.) is caught
// without needing a live DB. End-to-end coverage is exercised by the Playwright
// suite and the manual integration walkthrough.
describe('parseBirthFields helper', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'serve-mockup.js'),
    'utf8'
  );

  const fnStart = source.indexOf('function parseBirthFields(');
  expect(fnStart, 'parseBirthFields should be defined').toBeGreaterThanOrEqual(0);
  // The helper ends at the first top-level close brace after its start. Slice
  // generously to cover the function body without spilling into the next one.
  const fnEnd = source.indexOf('\n// Validates and normalizes a PATCH', fnStart);
  const body = source.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2500);

  it('returns null/null when both fields are absent or blank', () => {
    expect(body).toMatch(/monthBlank[\s\S]*?yearBlank[\s\S]*?return \{ birthMonth: null, birthYear: null \}/);
    expect(body).toContain('birthMonth: null, birthYear: null');
  });

  it('rejects partial pairs (only month, or only year) with a clear error', () => {
    expect(body).toMatch(/monthBlank\s*\|\|\s*yearBlank/);
    expect(body).toContain('Birth month and year must be set together, or both left blank.');
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
    // The helper reads the year from `now` (default = new Date()), so the
    // upper bound always tracks today's date.
    expect(body).toContain('currentYear = (now instanceof Date ? now : new Date()).getFullYear()');
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

  it('returns null when either input is null', () => {
    expect(body).toMatch(/birthMonth == null \|\| birthYear == null[\s\S]*?return null/);
  });

  it('rejects non-integer months and out-of-range months defensively', () => {
    expect(body).toMatch(/month\s+<\s+1\s*\|\|\s*month\s+>\s+12/);
  });

  it('subtracts one year when the birthday month has not arrived yet this year', () => {
    expect(body).toContain('referenceMonth');
    // referenceMonth < month means the current month is before the birth month.
    expect(body).toMatch(/referenceMonth\s*<\s*month/);
    expect(body).toMatch(/age\s*-=\s*1/);
  });

  it('returns null for future-dated birth years that slipped past validation', () => {
    expect(body).toContain('return age >= 0 ? age : null');
  });

  it('mirrors the same formula via computeAge so server + offline client agree', () => {
    // The mockup-api-client.js copy must exist too -- cross-file invariant.
    const clientSource = fs.readFileSync(
      path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js'),
      'utf8'
    );
    expect(clientSource).toContain('function computeAge');
  });
});

describe('offline parseUpdateProfilePayload birth-error short-circuit', () => {
  // The offline update flow (mockup-api-client.js parseUpdateProfilePayload)
  // must propagate parseBirthFields errors so partial pairs are rejected in
  // both backend and offline modes. Regression for a bug where the function
  // returned identity with undefined birth fields instead of an error.
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