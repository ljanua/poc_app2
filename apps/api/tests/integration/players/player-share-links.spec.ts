import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('share-token helpers', () => {
  it('generates an opaque base64url token of 32 random bytes', async () => {
    const { generateShareToken } = await import('../../../../../scripts/share-token.js');
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(generateShareToken()).not.toBe(token);
  });

  it('hashes tokens as sha256 hex and is stable', async () => {
    const { hashShareToken } = await import('../../../../../scripts/share-token.js');
    const token = 'test-token-value';
    const expected = createHash('sha256').update(token, 'utf8').digest('hex');
    expect(hashShareToken(token)).toBe(expected);
    expect(hashShareToken(token)).toBe(hashShareToken(token));
  });
});

describe('player_share_links migration artifacts', () => {
  const migrationPath = path.join(repoRoot, 'apps', 'api', 'src', 'db', 'migrations', '023_player_share_links.sql');
  const serveMockupPath = path.join(repoRoot, 'scripts', 'serve-mockup.js');
  const clientPath = path.join(repoRoot, 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js');
  const s2Path = path.join(repoRoot, 'docs', 'ux', 'mockup', 'S2-player-dashboard.html');

  it('creates the table idempotently with token_hash and revoked_at', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS player_share_links');
    expect(migration).toContain('token_hash TEXT NOT NULL UNIQUE');
    expect(migration).toContain('revoked_at TIMESTAMPTZ');
    expect(migration).toContain('REFERENCES players(id) ON DELETE CASCADE');
  });

  it('wires ensureDatabase and share routes in serve-mockup.js', () => {
    const source = fs.readFileSync(serveMockupPath, 'utf8');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS player_share_links');
    expect(source).toContain('generateShareToken');
    expect(source).toContain('findActiveShareByToken');
    expect(source).toContain('buildGuestSharePageUrl');
    expect(source).toMatch(/isSystemAdmin[\s\S]*isCoach/);
    expect(source).toContain('/share/');
  });

  it('exposes share client helpers and S2 guest/share UI', () => {
    const client = fs.readFileSync(clientPath, 'utf8');
    expect(client).toContain('getDashboardByShareToken');
    expect(client).toContain('createPlayerShare');
    expect(client).toContain('revokePlayerShare');
    expect(client).toContain('clipMediaUrlForShare');
    expect(client).toContain('listClipsByShareToken');

    const s2 = fs.readFileSync(s2Path, 'utf8');
    expect(s2).toContain('data-testid="share-link-button"');
    expect(s2).toContain('data-testid="revoke-share-button"');
    expect(s2).toContain("params.get('share')");
    expect(s2).toContain("dashboard-clip-play");
    expect(s2).toContain('Guest View');
  });

  it('does not persist the raw token shape in migration (hash only)', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');
    expect(migration).not.toMatch(/raw_token|plaintext/);
    expect(migration).toContain('token_hash');
    expect(randomBytes(8).length).toBe(8);
  });
});
