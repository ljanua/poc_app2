import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('player data audits API + client (Feature 036)', () => {
  const servePath = path.join(process.cwd(), 'scripts', 'serve-mockup.js');
  const clientPath = path.join(process.cwd(), 'docs', 'ux', 'mockup', 'js', 'mockup-api-client.js');
  const s2Path = path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S2-player-dashboard.html');

  it('wires insert helper and skill PUT / profile PATCH audit paths', () => {
    const serve = fs.readFileSync(servePath, 'utf8');
    expect(serve).toContain('async function insertPlayerDataAudit');
    expect(serve).toContain("entity: 'skill_rating'");
    expect(serve).toContain("source: 'coach_ui'");
    expect(serve).toContain('/audits$');
    expect(serve).toContain('resolvePlayerHistoryViewer');
  });

  it('exposes listPlayerDataAudits on the mockup client', () => {
    const client = fs.readFileSync(clientPath, 'utf8');
    expect(client).toContain('listPlayerDataAudits(playerId');
    expect(client).toContain("/audits'");
  });

  it('renders Change History on S2 and hides for guests', () => {
    const s2 = fs.readFileSync(s2Path, 'utf8');
    expect(s2).toContain('data-testid="change-history-section"');
    expect(s2).toContain('listPlayerDataAudits');
    expect(s2).toContain("section === 'change-history'");
    expect(s2).toContain('isGuest');
  });
});
