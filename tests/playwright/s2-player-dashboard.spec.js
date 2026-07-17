const { test, expect } = require('@playwright/test');

test.describe('S2 Player Development Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Force the offline/local fallback client, matching the pattern used by
    // tests/playwright/s1-player-list.spec.js. Without this, these tests
    // depend on whether the machine running them happens to have
    // DATABASE_URL configured for scripts/serve-mockup.js: with it configured
    // (as in local dev), requests hit the real backend unauthenticated (no
    // session email set here) and get a 403, which the dashboard cannot tell
    // apart from "unavailable" -- hiding the page instead of exercising the
    // seeded fixtures these tests assert against.
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_s2_dashboard_sections');
    });
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByText('Player Development')).toBeVisible();
  });

  test('shows key development, match time, and performance sections', async ({ page }) => {
    await expect(page.getByText('Development Progress')).toBeVisible();
    await expect(page.getByText('Match Time History')).toBeVisible();
    await expect(page.getByText('Recent Performance')).toBeVisible();
    await expect(page.getByText('Video Assessments')).toBeVisible();

    // Sections default collapsed; bodies stay hidden until expanded.
    await expect(page.locator('#body-development-progress')).toBeHidden();
    await expect(page.locator('#body-match-time')).toBeHidden();
    await expect(page.locator('#body-recent-performance')).toBeHidden();
    await expect(page.getByText('Current Level')).toBeHidden();
    await expect(page.getByText('Total Minutes')).toBeHidden();
    await expect(page.getByText('Avg Score')).toBeHidden();
  });

  test('collapses and expands dashboard sections when clicking section titles', async ({ page }) => {
    const devToggle = page.getByTestId('dashboard-section-toggle-development-progress');
    const devBody = page.locator('#body-development-progress');

    await expect(devToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#metricCurrentLevel')).toBeHidden();

    await devToggle.click();
    await expect(devToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(devBody).toBeVisible();
    await expect(page.locator('#metricCurrentLevel')).toBeVisible();

    await devToggle.click();
    await expect(devToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(devBody).toBeHidden();
    await expect(page.locator('#metricCurrentLevel')).toBeHidden();
  });

  test('defaults each Skill Ratings position group to collapsed and toggles independently', async ({ page }) => {
    // Skill Ratings is no longer collapsed as a whole; the section body stays
    // visible and each position group starts collapsed, toggling on its own.
    await expect(page.getByText('Skill Ratings')).toBeVisible();
    await expect(page.locator('#body-skill-ratings')).toBeVisible();

    const anyToggle = page.getByTestId('skill-ratings-any-toggle');
    const anyBody = page.locator('#body-skill-any');
    // Default collapsed on first visit (cleared storage in beforeEach).
    await expect(anyToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(anyBody).toBeHidden();

    await anyToggle.click();
    await expect(anyToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(anyBody).toBeVisible();

    await anyToggle.click();
    await expect(anyToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(anyBody).toBeHidden();
  });

  test('remembers per-player Skill Ratings group expand state across reloads', async ({ page }) => {
    const anyToggle = page.getByTestId('skill-ratings-any-toggle');
    const anyBody = page.locator('#body-skill-any');

    // Both groups default collapsed.
    await expect(anyToggle).toHaveAttribute('aria-expanded', 'false');

    // Expand "Any Position" and confirm it persists across a reload.
    await anyToggle.click();
    await expect(anyBody).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('skill-ratings-any-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#body-skill-any')).toBeVisible();

    // The stored state records the group slug under the player's entry in the
    // shared dashboard-sections object.
    const stored = await page.evaluate(() => {
      return window.localStorage.getItem('vantageiq_s2_dashboard_sections') || '{}';
    });
    expect(stored).toContain('skill-any');

    // A different player defaults collapsed (per-player independence), then the
    // original player restores the expanded choice.
    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Cristiano Ronaldo'));
    await page.goto('/S2-player-dashboard.html');
    await expect(page.getByTestId('skill-ratings-any-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  test('renders Change History as the last section, just above the action buttons', async ({ page }) => {
    // Change History is the final .section on the dashboard.
    const lastSectionId = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('.section'));
      const last = sections[sections.length - 1];
      return last ? last.getAttribute('data-section') : null;
    });
    expect(lastSectionId).toBe('change-history');

    // The action row with "Compare Player" comes immediately after it.
    const nextIsActions = await page.evaluate(() => {
      const history = document.querySelector('[data-section="change-history"]');
      let el = history ? history.nextElementSibling : null;
      while (el && !el.classList.contains('cta-buttons')) {
        el = el.nextElementSibling;
      }
      return Boolean(el && /Compare Player/.test(el.textContent || ''));
    });
    expect(nextIsActions).toBe(true);

    // Development Progress now immediately follows Skill Ratings (Change
    // History no longer sits between them).
    const afterSkills = await page.evaluate(() => {
      const skills = document.querySelector('[data-section="skill-ratings"]');
      let el = skills ? skills.nextElementSibling : null;
      while (el && !el.classList.contains('section')) {
        el = el.nextElementSibling;
      }
      return el ? el.getAttribute('data-section') : null;
    });
    expect(afterSkills).toBe('development-progress');
  });

  test('shows a right-aligned bright-yellow average for each position group', async ({ page }) => {
    // Default Messi (id 10) has Any Position ratings 88, 84, 90, null, 76.
    // Mean of the numeric > 0 values = round(338 / 4) = 85 (matches S1 logic).
    const anyAverage = page.getByTestId('skill-ratings-any-average');
    await expect(anyAverage).toBeVisible();
    await expect(anyAverage).toHaveText('85%');

    const color = await anyAverage.evaluate((el) => getComputedStyle(el).color);
    // #facc15 -> rgb(250, 204, 21)
    expect(color).toBe('rgb(250, 204, 21)');
  });

  test('persists expanded section state per player in localStorage', async ({ page }) => {
    const devToggle = page.getByTestId('dashboard-section-toggle-development-progress');

    await devToggle.click();
    await expect(devToggle).toHaveAttribute('aria-expanded', 'true');

    await page.reload();
    await expect(devToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#metricCurrentLevel')).toBeVisible();

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Cristiano Ronaldo'));
    const ronaldoDevToggle = page.getByTestId('dashboard-section-toggle-development-progress');
    await expect(ronaldoDevToggle).toHaveAttribute('aria-expanded', 'false');

    await page.goto('/S2-player-dashboard.html');
    await expect(devToggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('shows real per-player metric change badges instead of static placeholders', async ({ page }) => {
    await page.getByTestId('dashboard-section-toggle-development-progress').click();

    const currentLevelChange = page.locator('#metricCurrentLevelChange');
    const fitnessChange = page.locator('#metricFitnessChange');
    const skillChange = page.locator('#metricSkillChange');

    await expect(currentLevelChange).toBeVisible();
    await expect(fitnessChange).toBeVisible();
    await expect(skillChange).toBeVisible();

    // Default player (Lionel Messi) resolves through the offline/local fallback
    // client in CI (no DATABASE_URL configured), which mirrors the exact seeded
    // values used by the Postgres-backed path for this named profile.
    await expect(currentLevelChange).toHaveText(/Up 5%/);
    await expect(currentLevelChange).toHaveClass(/badge-improving/);
    await expect(fitnessChange).toHaveText(/Stable/);
    await expect(fitnessChange).toHaveClass(/badge-plateau/);
    await expect(skillChange).toHaveText(/Up 3%/);
    await expect(skillChange).toHaveClass(/badge-improving/);
  });

  test('provides actions to view results and submit clips', async ({ page }) => {
    await page.getByTestId('dashboard-section-toggle-video-assessments').click();
    const viewResults = page.getByTestId('view-results-link');
    await expect(viewResults).toHaveAttribute('href', /S6-assessment-list\.html\?.*playerName=Lionel(\+|%20)Messi/);
    await expect(viewResults).toHaveAttribute('href', /teamName=/);
    await viewResults.click();
    await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);
    await expect(page).toHaveURL(/playerName=Lionel(\+|%20)Messi/);
    await expect(page.getByTestId('preselected-player-filter')).toBeChecked();

    await page.goto('/S2-player-dashboard.html');
    // Both clip CTAs carry playerId (new-clip link may be inside a collapsed section).
    const submitHrefs = await page.evaluate(() => ({
      newClip: document.getElementById('submitNewClipLink')
        ? document.getElementById('submitNewClipLink').getAttribute('href')
        : null,
      clip: document.getElementById('submitClipLink')
        ? document.getElementById('submitClipLink').getAttribute('href')
        : null
    }));
    expect(submitHrefs.newClip).toMatch(/S4-video-capture\.html\?playerId=/);
    expect(submitHrefs.clip).toMatch(/S4-video-capture\.html\?playerId=/);

    const playerId = new URL(submitHrefs.clip, 'http://localhost').searchParams.get('playerId');
    expect(playerId).toBeTruthy();
    await page.getByTestId('submit-clip-link').click();
    await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);
    await expect(page).toHaveURL(new RegExp('playerId=' + playerId));
    await expect(page.locator('#player')).toHaveValue(String(playerId));
  });

  test('shows the player card only, and never fabricated stats, for a player with no recorded stats', async ({ page }) => {
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 999,
        name: 'Rookie Carter',
        normalizedName: 'rookie carter',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Rookie Carter'));

    await expect(page.getByText('Player Development')).toBeVisible();
    await expect(page.locator('#dashboardPlayerName')).toHaveText('Rookie Carter');
    await expect(page.locator('#dashboardTeamChip')).toHaveText('U19 Prime');

    await expect(page.locator('#noStatsNotice')).toBeVisible();
    await expect(page.locator('#noStatsNotice')).toContainText('Performance metrics are not available yet.');

    await expect(page.getByText('Development Progress')).toBeHidden();
    await expect(page.getByText('Match Time History')).toBeHidden();
    await expect(page.getByText('Recent Performance')).toBeHidden();
    await expect(page.getByText('Skill Ratings')).toBeHidden();
    await expect(page.getByText('Video Assessments')).toBeHidden();

    // Never shows another player's borrowed numbers or narrative text.
    await expect(page.getByText('Pace was strong, timing can improve.')).toHaveCount(0);
    await expect(page.getByText('Confident execution under pressure.')).toHaveCount(0);

    // The final CTA row stays available even with no stats yet.
    await expect(page.getByRole('link', { name: 'Submit a Clip' })).toBeVisible();
    await expect(page.getByTestId('submit-clip-link')).toHaveAttribute(
      'href',
      /S4-video-capture\.html\?playerId=999/
    );

    // Editing is still reachable for a no-stats player -- it is how the coach
    // records their first real stats.
    const editLink = page.locator('#editPlayerLink');
    await expect(editLink).toBeVisible();
    await expect(editLink).toHaveAttribute('href', /S5-player-edit\.html\?playerId=999/);
  });

  test('shows Video Assessments with per-clip status when a no-stats player has clips', async ({ page }) => {
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 998,
        name: 'Clip Rookie',
        normalizedName: 'clip rookie',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      store.clips = store.clips || [];
      store.clips.push({
        id: 9001,
        playerId: 998,
        situation: 'First training clip under pressure',
        status: 'submitted',
        score: null,
        summary: '',
        submittedAt: 'Submitted just now',
        skill: 'Ball Control',
        skillFocus: ['Ball Control'],
        skillRatings: null
      });
      store.clips.push({
        id: 9002,
        playerId: 998,
        situation: 'Failed processing sample',
        status: 'failed',
        score: null,
        summary: '',
        errorMessage: 'Processing failed',
        submittedAt: 'Submitted earlier',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: null
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Clip Rookie'));

    await expect(page.locator('#noStatsNotice')).toBeVisible();
    // Player has clips but no performance stats -> partial notice.
    await expect(page.locator('#noStatsNotice')).toContainText(
      'Some of the performance metrics are not available yet.'
    );
    await expect(page.getByText('Development Progress')).toBeHidden();
    await expect(page.getByText('Skill Ratings')).toBeHidden();
    await expect(page.getByText('Video Assessments')).toBeVisible();

    await page.getByTestId('dashboard-section-toggle-video-assessments').click();
    await expect(page.getByTestId('dashboard-clip-list')).toBeVisible();
    await expect(page.getByTestId('dashboard-clip-row')).toHaveCount(2);
    await expect(page.getByTestId('dashboard-clip-status').filter({ hasText: 'submitted' })).toBeVisible();
    await expect(page.getByTestId('dashboard-clip-status').filter({ hasText: 'failed' })).toBeVisible();
    await expect(page.getByText('First training clip under pressure')).toBeVisible();
    await expect(page.getByTestId('view-results-link')).toBeVisible();
    await expect(page.getByTestId('submit-new-clip-link')).toBeVisible();
  });

  test('shows Skill Ratings when a no-stats player has recorded ratings', async ({ page }) => {
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 997,
        name: 'Rated Rookie',
        normalizedName: 'rated rookie',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      store.playerSkillRatings = store.playerSkillRatings || [];
      store.playerSkillRatings.push({
        playerId: 997,
        skillId: 's_ball_control',
        rating: 84
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Rated Rookie'));

    await expect(page.locator('#noStatsNotice')).toBeVisible();
    // Player has a recorded skill rating but no performance stats -> partial notice.
    await expect(page.locator('#noStatsNotice')).toContainText(
      'Some of the performance metrics are not available yet.'
    );
    await expect(page.getByText('Development Progress')).toBeHidden();
    await expect(page.getByText('Skill Ratings')).toBeVisible();

    // The average shows on the always-visible group title row even while collapsed.
    await expect(page.getByTestId('skill-ratings-any-average')).toHaveText('84%');

    // The group defaults collapsed; expand to reveal the rating value cell.
    await page.getByTestId('skill-ratings-any-toggle').click();
    await expect(page.getByTestId('skill-rating-value-s_ball_control')).toHaveText('84%');
  });

  test('lists each clip with status for a player who has stats', async ({ page }) => {
    // Default Lionel Messi has a seeded complete clip in the offline store.
    await page.getByTestId('dashboard-section-toggle-video-assessments').click();
    await expect(page.getByTestId('dashboard-clip-row')).toHaveCount(1);
    await expect(page.getByTestId('dashboard-clip-status').first()).toHaveText('complete');
    await expect(page.getByText('Penalty kick attempt, 3rd minute')).toBeVisible();
  });

  test('exposes an Edit Player link that targets the viewed player', async ({ page }) => {
    const editLink = page.locator('#editPlayerLink');
    await expect(editLink).toBeVisible();
    // Default player (Lionel Messi) has seed id 10 in the offline store.
    await expect(editLink).toHaveAttribute('href', /S5-player-edit\.html\?playerId=10/);
  });

  test('removes the team dropdown and the redundant back-to-list button', async ({ page }) => {
    // The team dropdown and "Back to Player List" button were removed; the team
    // chip still shows the player's team and the header back arrow handles nav.
    await expect(page.locator('#dashboardTeamSelect')).toHaveCount(0);
    await expect(page.locator('#backToListLink')).toHaveCount(0);
    await expect(page.locator('#dashboardTeamChip')).toHaveText('U19 Prime');
  });

  test('renders Edit / Share / Revoke as icon buttons with tooltip labels on one line', async ({ page }) => {
    const editLink = page.locator('#editPlayerLink');
    await expect(editLink).toBeVisible();
    await expect(editLink).toHaveAttribute('title', 'Edit Player');
    await expect(editLink).toHaveAttribute('aria-label', 'Edit Player');

    const shareButton = page.getByTestId('share-link-button');
    await expect(shareButton).toBeVisible();
    await expect(shareButton).toHaveAttribute('title', /Share link|New share link/);
    await expect(shareButton).toHaveAttribute('aria-label', /Share link|New share link/);

    // Action row stays on a single line (all controls share the same top edge).
    const editBox = await editLink.boundingBox();
    const shareBox = await shareButton.boundingBox();
    expect(editBox).not.toBeNull();
    expect(shareBox).not.toBeNull();
    expect(Math.abs(editBox.y - shareBox.y)).toBeLessThan(4);
  });

  test('shows emoji avatar for a player with no uploaded photo', async ({ page }) => {
    const emoji = page.locator('#playerAvatarEmoji');
    await expect(emoji).toBeVisible();
    await expect(emoji).toHaveText('⚽');
    const img = page.locator('#playerAvatarImg');
    await expect(img).toBeHidden();
  });

  test('uploading an avatar updates the avatar preview immediately on S2', async ({ page }) => {
    // Seed a player with an avatar URL directly in localStorage
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.playerAvatars = store.playerAvatars || {};
      store.playerAvatars[10] = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S2-player-dashboard.html');
    await expect(page.locator('#playerAvatarImg')).toBeVisible();
    await expect(page.locator('#playerAvatarEmoji')).toBeHidden();
  });

  test('shows the seeded player age on the S2 meta line (Lionel Messi)', async ({ page }) => {
    // Default Messi seed uses birthYear = currentYear − 19 (U19 age-group default).
    const meta = await page.locator('#dashboardPlayerMeta').textContent();
    expect(meta).toMatch(/Age \d+/);
    const match = meta.match(/Age (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBe(19);
  });

  test('omits the age segment when the player has no birth date', async ({ page }) => {
    // Add a player without birth fields and assert the meta line drops the
    // "Age N" segment, falling back to just the position.
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 9999,
        name: 'Age Test Carter',
        normalizedName: 'age test carter',
        teamName: 'U19 Prime',
        position: 'Forward - Center Forward',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Age Test Carter'));
    const meta = await page.locator('#dashboardPlayerMeta').textContent();
    expect(meta).not.toMatch(/Age \d+/);
  });
});
