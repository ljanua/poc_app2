import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('S2 — collapsible dashboard sections', () => {
  const s2 = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'S2-player-dashboard.html'),
    'utf8'
  );
  const css = fs.readFileSync(
    path.join(process.cwd(), 'docs', 'ux', 'mockup', 'style', 'site.css'),
    'utf8'
  );

  const toggleTestIds = [
    'dashboard-section-toggle-skill-ratings',
    'dashboard-section-toggle-development-progress',
    'dashboard-section-toggle-match-time',
    'dashboard-section-toggle-recent-performance',
    'dashboard-section-toggle-video-assessments',
  ];

  it('defines five section toggle buttons with test ids', () => {
    toggleTestIds.forEach((testId) => {
      expect(s2).toContain(`data-testid="${testId}"`);
    });
  });

  it('wraps each stats section body for collapse', () => {
    expect(s2).toContain('id="body-skill-ratings"');
    expect(s2).toContain('id="body-development-progress"');
    expect(s2).toContain('id="body-match-time"');
    expect(s2).toContain('id="body-recent-performance"');
    expect(s2).toContain('id="body-video-assessments"');
    expect((s2.match(/class="section-body"/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  it('wires initDashboardSectionToggles and is-collapsed class', () => {
    expect(s2).toContain('initDashboardSectionToggles');
    expect(s2).toContain('is-collapsed');
    expect(s2).toContain('aria-expanded');
    expect(s2).toContain('vantageiq_s2_dashboard_sections');
  });

  it('styles collapsed section bodies in site.css', () => {
    expect(css).toContain('.stats-section.is-collapsed .section-body');
    expect(css).toContain('.section-toggle');
  });
});
