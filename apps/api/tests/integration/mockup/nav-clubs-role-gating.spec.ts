import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockupDir = path.join(process.cwd(), 'docs', 'ux', 'mockup');
const clientSrc = fs.readFileSync(
  path.join(mockupDir, 'js', 'mockup-api-client.js'),
  'utf8'
);

// Bottom-nav pages that should expose the role-gated Clubs entry. S0 (login)
// is intentionally excluded: it has no nav, and S7a is the Clubs page itself
// (it's reached via the new nav entry rather than carrying it).
const navPages = [
  'S1-player-list.html',
  'S2-player-dashboard.html',
  'S3-team-management.html',
  'S3a-team-update.html',
  'S4-video-capture.html',
  'S5-player-edit.html',
  'S6-assessment-list.html',
  'S7-admin-user-management.html',
  'S7a-clubs.html'
];

describe('Bottom-nav role gating (Clubs entry)', () => {
  it('exposes MockupApi.applyRoleGatedNav on the public surface', () => {
    expect(clientSrc).toMatch(/applyRoleGatedNav\s*\(/);
    // The method should walk all [data-role-visible-to] nodes.
    expect(clientSrc).toContain("querySelectorAll('[data-role-visible-to]'");
  });

  it('declares a Clubs entry with data-role-visible-to="SystemAdmin" in every nav page', () => {
    for (const page of navPages) {
      const pageSrc = fs.readFileSync(path.join(mockupDir, page), 'utf8');
      const navStart = pageSrc.indexOf('<nav class="bottom-nav">');
      const navEnd = pageSrc.indexOf('</nav>', navStart);
      expect(navStart, `${page} should have a bottom-nav`).toBeGreaterThanOrEqual(0);
      expect(navEnd, `${page} bottom-nav should be closed`).toBeGreaterThan(navStart);
      const navBlock = pageSrc.slice(navStart, navEnd);

      // The Clubs link must be inside the bottom-nav and gated to SystemAdmin.
      const clubsMatch = navBlock.match(/href="\.\/S7a-clubs\.html"[^>]*data-role-visible-to="SystemAdmin"/)
        || navBlock.match(/data-role-visible-to="SystemAdmin"[^>]*href="\.\/S7a-clubs\.html"/);
      expect(clubsMatch, `${page} should declare a Clubs nav entry gated to SystemAdmin`).not.toBeNull();
    }
  });

  it('every nav page calls MockupApi.applyRoleGatedNav', () => {
    for (const page of navPages) {
      const pageSrc = fs.readFileSync(path.join(mockupDir, page), 'utf8');
      expect(
        pageSrc.includes('MockupApi.applyRoleGatedNav('),
        `${page} should call MockupApi.applyRoleGatedNav to honor the role-gated nav`
      ).toBe(true);
    }
  });

  it('hides the Clubs nav entry by default (hidden attribute present on the link)', () => {
    for (const page of navPages) {
      const pageSrc = fs.readFileSync(path.join(mockupDir, page), 'utf8');
      // The Clubs link inside the bottom-nav should ship hidden so a non-admin
      // user never sees a flash of admin-only chrome before JS hydrates the role.
      // Scope the regex to the bottom-nav block to avoid matching admin-page
      // "View List of Clubs" toolbar buttons (which are intentionally visible).
      const navStart = pageSrc.indexOf('<nav class="bottom-nav">');
      const navEnd = pageSrc.indexOf('</nav>', navStart);
      const navBlock = pageSrc.slice(navStart, navEnd);
      const clubsLineMatch = navBlock.match(/href="\.\/S7a-clubs\.html"[^>]*>/);
      expect(clubsLineMatch, `${page} bottom-nav should contain a Clubs link`).not.toBeNull();
      expect(clubsLineMatch && clubsLineMatch[0]).toContain('hidden');
    }
  });

  it('the Users nav link on S7 / S7a is also gated to SystemAdmin', () => {
    for (const page of ['S7-admin-user-management.html', 'S7a-clubs.html']) {
      const pageSrc = fs.readFileSync(path.join(mockupDir, page), 'utf8');
      const navStart = pageSrc.indexOf('<nav class="bottom-nav">');
      const navEnd = pageSrc.indexOf('</nav>', navStart);
      const navBlock = pageSrc.slice(navStart, navEnd);
      // S7 and S7a are admin pages; the Users link must remain SystemAdmin-only
      // even after the new Clubs nav entry is added.
      expect(navBlock).toMatch(/href="\.\/S7-admin-user-management\.html"[^>]*data-role-visible-to="SystemAdmin"/);
    }
  });
});