const { test, expect } = require('@playwright/test');

test.describe('S1 Player List team filter and add-player flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await expect(page.locator('#playerGrid')).toBeVisible();
  });

  test('bottom navigation routes to teams, capture, and assessments pages', async ({ page }) => {
    await page.locator('.bottom-nav .nav-item', { hasText: 'Teams' }).click();
    await expect(page).toHaveURL(/S3-team-management\.html|S3-team-management$/);

    await page.goto('/S1-player-list.html');
    await page.locator('.bottom-nav .nav-item', { hasText: 'Capture' }).click();
    await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);

    await page.goto('/S1-player-list.html');
    await page.locator('.bottom-nav .nav-item', { hasText: 'My Clips' }).click();
    await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);
  });

  test('shows only players assigned to selected team', async ({ page }) => {
    // Coach Joao only leads U19 Prime. His dropdown contains only [All Teams, U19 Prime],
    // so the only meaningful team filter is U19 Prime itself. Verify the status
    // banner switches to the team-scoped copy when he picks his team.
    await page.selectOption('#teamFilter', 'U19 Prime');
    await expect(page.locator('#playerListStatus')).toContainText('U19 Prime');
    await expect(page.locator('.player-card .player-name', { hasText: 'Lionel Messi' })).toBeVisible();

    // Switching back to "All Teams" keeps the coach-scoped roster (just U19 Prime's
    // players), but the status banner switches to the "in your clubs" copy because
    // Only My Players is on by default for Coach actors.
    await page.selectOption('#teamFilter', 'all');
    await expect(page.locator('#playerListStatus')).toContainText('your clubs');
    await expect(page.locator('.player-card .player-name', { hasText: 'Lionel Messi' })).toBeVisible();
  });

  test('initializes selected team from query string when valid', async ({ page }) => {
    // Joao does not lead Senior Squad, so the valid query-string team
    // resolves to "all" (his dropdown only lists U19 Prime) and the result
    // is filtered to his own players.
    await page.goto('/S1-player-list.html?team=Senior%20Squad');

    await expect(page.locator('#teamFilter')).toHaveValue('all');
    const cards = page.locator('.player-card .player-name');
    await expect(cards).toHaveCount(1);
    await expect(page.locator('.player-card .player-name', { hasText: 'Lionel Messi' })).toBeVisible();
  });

  test('shows only coach-assigned teams in the dropdown for coach sessions', async ({ page }) => {
    await page.evaluate(() => window.localStorage.setItem('vantageiq_current_user_email', 'joao@vantageiq.club'));
    await page.reload();

    // Floor: at least "All Teams" + one coach-owned team (U19 Prime). The
    // total grows as new teams accumulate across runs, so we don't pin a
    // hard count.
    await expect(await page.locator('#teamFilter option').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#teamFilter')).toContainText('All Teams');
    await expect(page.locator('#teamFilter')).toContainText('U19 Prime');
    await expect(page.locator('#teamFilter')).not.toContainText('Senior Squad');
  });

  test('shows all available teams in the dropdown for system admin sessions', async ({ page }) => {
    await page.evaluate(() => window.localStorage.setItem('vantageiq_current_user_email', 'maria@vantageiq.club'));
    await page.reload();

    // Floor: at least "All Teams" + 3 seeded teams. Extras from prior runs
    // are accepted — admin sees every team.
    await expect(await page.locator('#teamFilter option').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('#teamFilter')).toContainText('All Teams');
    await expect(page.locator('#teamFilter')).toContainText('U17 Elite');
    await expect(page.locator('#teamFilter')).toContainText('U19 Prime');
    await expect(page.locator('#teamFilter')).toContainText('Senior Squad');
  });

  test('falls back to all teams when query string team is invalid', async ({ page }) => {
    await page.goto('/S1-player-list.html?team=Unknown%20Team');

    await expect(page.locator('#teamFilter')).toHaveValue('all');
    // Coach-scoped: Joao sees only his own team's player (Messi on U19 Prime).
    await expect(page.locator('.player-card .player-name')).toHaveCount(1);
    await expect(page.locator('.player-card .player-name', { hasText: 'Lionel Messi' })).toBeVisible();
    await expect(page.locator('#playerListStatus')).toContainText('your clubs');
  });

  test('adds a player from name lookup and reassigns to selected team', async ({ page }) => {
    // Coach Joao only leads U19 Prime; the add-player flow is gated to a specific team.
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await page.fill('#addPlayerInput', 'ney');
    await page.fill('#addPlayerInput', 'Neymar Jr');
    await page.getByRole('button', { name: 'Add to Team' }).click();

    await expect(page.locator('#toast')).toContainText('Neymar Jr moved to U19 Prime.');
    await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toBeVisible();
  });

  test('blocks add action when no valid dropdown match exists', async ({ page }) => {
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await page.fill('#addPlayerInput', 'zzz');
    await expect(page.locator('#addPlayerHint')).toContainText('No exact match found. Confirm create-on-no-match before submit.');
    await expect(page.locator('#createConfirm')).toBeChecked();

    await page.locator('#createConfirm').uncheck();
    await page.getByRole('button', { name: 'Add to Team' }).click();
    await expect(page.locator('#addPlayerHint')).toContainText('Choose a player from the dropdown matches.');
  });

  test('requires selecting a specific team before add-player suggestions are enabled', async ({ page }) => {
    await page.selectOption('#teamFilter', 'all');
    await page.getByRole('button', { name: 'Add Player' }).click();

    await expect(page.locator('#addPlayerHint')).toContainText('Select a specific team before adding players.');
    await expect(page.getByRole('button', { name: 'Add to Team' })).toBeDisabled();
  });

  test('keeps explicit mock-local behavior for offline regression runs', async ({ page }) => {
    // Coach Joao is the lead of U19 Prime only; with Only My Players ON he
    // sees only Messi (the seeded player on U19 Prime). Extras accumulate
    // across runs, so we don't pin a hard count.
    const cardNames = page.locator('.player-card .player-name');
    await expect(cardNames).toHaveCount(1);
    await expect(cardNames).toContainText(['Lionel Messi']);
  });

  test('shows emoji avatar for players without an uploaded photo', async ({ page }) => {
    const cards = page.locator('.player-card');
    // Coach scope: Joao sees exactly the player on the team he leads.
    await expect(cards).toHaveCount(1);
    // Each card should show ⚽ emoji in the avatar slot and have no has-avatar modifier
    await expect(page.locator('.player-card .player-image').first()).toContainText('⚽');
    await expect(page.locator('.player-card .player-image.has-avatar')).toHaveCount(0);
  });

  test('shows uploaded avatar image on player card when avatarUrl is set', async ({ page }) => {
    // Seed player 10 (Lionel Messi) with an avatar URL in playerAvatars
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.playerAvatars = store.playerAvatars || {};
      store.playerAvatars[10] = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.reload();
    const messiCard = page.locator('[data-player-id="10"]');
    await expect(messiCard).toBeVisible();
    const avatarImg = messiCard.locator('.player-image img');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('src', /^data:image\//);
    await expect(messiCard.locator('.player-image')).not.toContainText('⚽');
    await expect(messiCard.locator('.player-image')).toHaveClass(/has-avatar/);
  });

  test('shows video icon only for players with clips and deep-links to S6', async ({ page }) => {
    const messiCard = page.locator('.player-card[data-player-id="10"]');
    await expect(messiCard).toBeVisible();
    const videoLink = messiCard.getByTestId('player-card-video-link');
    await expect(videoLink).toBeVisible();
    await expect(videoLink).toHaveAttribute('href', /S6-assessment-list\.html\?.*playerId=10/);
    await expect(videoLink).toHaveAttribute('href', /playerName=Lionel%20Messi|playerName=Lionel\+Messi/);
    await expect(messiCard.locator('.view-btn')).toHaveCount(0);

    await videoLink.click();
    await expect(page).toHaveURL(/S6-assessment-list\.html/);
    await expect(page.getByTestId('preselected-player-filter')).toBeChecked();
    await expect(page.getByText('Lionel Messi').first()).toBeVisible();
  });

  test('hides video icon for players with no clips', async ({ page }) => {
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.players.push({
        id: 991,
        name: 'No Clip Nova',
        normalizedName: 'no clip nova',
        teamName: 'U19 Prime',
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });
    await page.reload();
    const card = page.locator('.player-card[data-player-id="991"]');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('player-card-video-link')).toHaveCount(0);
    await expect(card.locator('.view-btn')).toHaveCount(0);
  });

  test('card click opens S2 dashboard and omits Updated label', async ({ page }) => {
    const messiCard = page.locator('.player-card[data-player-id="10"]');
    await expect(messiCard).toBeVisible();
    await expect(messiCard).not.toContainText(/Updated/i);
    await messiCard.locator('.player-name').click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html\?.*player=Lionel(%20|\+)Messi/);
  });

  test('shows Any-position skill abbreviations and ratings on the card', async ({ page }) => {
    const messiCard = page.locator('.player-card[data-player-id="10"]');
    await expect(messiCard.getByTestId('player-card-skills')).toBeVisible();
    await expect(messiCard.getByTestId('player-card-skill-abbr')).toHaveCount(5);
    for (const abbr of ['AWR', 'BCN', 'FIT', 'PAS', 'SPD']) {
      await expect(messiCard.getByTestId('player-card-skill-abbr').filter({ hasText: abbr })).toHaveCount(1);
    }
    await expect(messiCard.getByTestId('player-card-skill-rating')).toHaveCount(5);
    await expect(messiCard.getByTestId('player-card-skill-rating').filter({ hasText: '84%' })).toHaveCount(1);
    await expect(messiCard.getByTestId('player-card-skill-rating').filter({ hasText: '—' })).toHaveCount(1);
    await expect(messiCard.getByTestId('player-card-trend')).toHaveAttribute('aria-label', 'Improving');
  });
});

// Regression: avatar uploaded via the live backend PATCH must surface on the
// S1 list rendered from GET /v1/players. Catches two regressions at once:
//   1. toPlayerPayload dropping avatarUrl from the list response (U0).
//   2. S1 render path failing to render the image after a live write.
//
// These tests run against the live backend (no __USE_BACKEND__ = false) so
// they catch the round-trip through scripts/serve-mockup.js. Mirrors the
// pattern in tests/playwright/s2-player-avatar-backend.spec.js.

const TINY_JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A//2Q==';

async function loginAsCoach(page) {
  await page.goto('/S0-login.html');
  await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  await page.fill('#email', 'joao@vantageiq.club');
  await page.fill('#password', 'SecurePass123');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
}

test.describe('S1 Player List avatar renders against live backend', () => {
  test.beforeEach(async ({ page }) => {
    // Explicitly do NOT force offline mode — these tests exercise the
    // GET /v1/players round-trip through the live backend.
    await loginAsCoach(page);
  });

  test('uploaded avatar renders on the S1 card after live PATCH + reload', async ({ page }) => {
    const result = await page.evaluate(async (dataUrl) => {
      const players = await window.MockupApi.listPlayers({ teamName: 'all' });
      const target = (players || [])[0];
      if (!target) {
        return { skipped: true, reason: 'no players seeded in backend' };
      }
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'avatar.jpg', { type: 'image/jpeg' });
      const upload = await window.MockupApi.uploadPlayerAvatar(target.id, file);
      return { upload, targetId: target.id };
    }, TINY_JPEG_DATA_URL);

    if (result && result.skipped) {
      test.skip(true, result.reason);
    }

    expect(result.upload.error, `upload returned an error: ${result.upload.error}`).toBeUndefined();
    expect(result.upload.status, `status should be 200, got ${result.upload.status}`).toBe(200);

    // Force a fresh GET /v1/players round-trip so the S1 render reads the
    // server-side avatarUrl (rather than the cached in-memory list).
    await page.goto('/S1-player-list.html');

    const targetCard = page.locator('[data-player-id="' + result.targetId + '"]');
    await expect(targetCard).toBeVisible();
    const avatarImg = targetCard.locator('.player-image img');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('src', /^data:image\/jpeg/);
    await expect(targetCard.locator('.player-image')).not.toContainText('⚽');
    await expect(targetCard.locator('.player-image')).toHaveClass(/has-avatar/);
  });

  test('inline add-player panel prefills birth year from team age group', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S1-player-list.html');
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.locator('#toggleAddPlayer').click();
    await expect(page.locator('#addPlayerPanel')).toBeVisible();
    const expectedYear = String(new Date().getFullYear() - 19);
    await expect(page.locator('#addPlayerBirthYear')).toHaveValue(expectedYear);
    await expect(page.locator('#addPlayerBirthMonth')).toHaveValue('');
  });

  test('inline add-player panel accepts birth month and year and persists them', async ({ page }) => {
    // Force offline mode for this test so the create lands in the local
    // store (and we can assert directly against localStorage). The other
    // tests in this describe block intentionally exercise the live backend.
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S1-player-list.html');
    // First pick a real team so the inline add-player panel populates
    // sport-defined positions and unlocks the create button.
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.locator('#toggleAddPlayer').click();
    await expect(page.locator('#addPlayerPanel')).toBeVisible();

    // Pick a sport-defined position so the create flow doesn't fall back to
    // "Position not set" -- birth fields work either way, but a real position
    // makes the assertions cleaner.
    await page.selectOption('#addPlayerPosition', { index: 1 });
    await page.fill('#addPlayerInput', 'Birth Test Carter');
    await page.selectOption('#addPlayerBirthMonth', '3');
    await page.fill('#addPlayerBirthYear', '2005');
    await page.locator('#createConfirm').check();
    await page.locator('#addPlayerSubmit').click();

    // The new player is in the offline store with the birth fields preserved.
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      if (!raw) return null;
      const store = JSON.parse(raw);
      return store.players.find((p) => p.name === 'Birth Test Carter');
    });
    expect(stored).toBeTruthy();
    expect(stored.birthMonth).toBe(3);
    expect(stored.birthYear).toBe(2005);
  });

  test('inline add-player panel rejects month-only birth and shows a validation error', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S1-player-list.html');
    await page.selectOption('#teamFilter', 'U19 Prime');
    await page.locator('#toggleAddPlayer').click();
    await expect(page.locator('#addPlayerPanel')).toBeVisible();
    await page.selectOption('#addPlayerPosition', { index: 1 });
    await page.fill('#addPlayerInput', 'Partial Birth Carter');
    await page.selectOption('#addPlayerBirthMonth', '3');
    // Clear the age-group default year so only month is set.
    await page.fill('#addPlayerBirthYear', '');
    await page.locator('#createConfirm').check();
    await page.locator('#addPlayerSubmit').click();
    await expect(page.locator('#addPlayerHint')).toContainText(/without a birth year|cannot be set/i);
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('vantageiq_mockup_v2');
      if (!raw) return undefined;
      const store = JSON.parse(raw);
      return (store.players || []).find((p) => p.name === 'Partial Birth Carter');
    });
    expect(stored).toBeUndefined();
  });
});
