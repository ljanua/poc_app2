const { test, expect } = require('@playwright/test');

test.describe('S6 Assessment Results list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    // Always sign in as coach joao@vantageiq.club before every test in this suite.
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
  });

  test('shows assessed and pending result cards with status badges', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();
    await expect(page.locator('.status-assessed')).toHaveCount(3);
    await expect(page.locator('.status-pending')).toHaveCount(1);
    await expect(page.getByText('Lionel Messi')).toBeVisible();
    await expect(page.getByText('Cristiano Ronaldo')).toBeVisible();
    await expect(page.getByText('Neymar Jr')).toBeVisible();
  });

  test('renders clip comments above the rating row on assessed cards', async ({ page }) => {
    const firstAssessedCard = page.locator('.result-card').filter({ has: page.locator('.status-assessed') }).first();
    await expect(firstAssessedCard.locator('.result-comment')).toBeVisible();
    const commentIndex = await firstAssessedCard.locator('.result-comment').evaluate((node) => {
      const card = node.closest('.result-card');
      const children = Array.from(card.querySelectorAll('.result-comment, .result-rating'));
      return children.indexOf(node);
    });
    const ratingIndex = await firstAssessedCard.locator('.result-rating').evaluate((node) => {
      const card = node.closest('.result-card');
      const children = Array.from(card.querySelectorAll('.result-comment, .result-rating'));
      return children.indexOf(node);
    });
    expect(commentIndex).toBeGreaterThanOrEqual(0);
    expect(ratingIndex).toBeGreaterThan(commentIndex);
  });

  test('shows percent scores and bright star only above 80%', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();

    const messiCard = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(messiCard.getByTestId('rating-label')).toHaveText('84%');
    await expect(messiCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'true');
    await expect(messiCard.getByTestId('rating-star')).not.toHaveClass(/rating-star--muted/);
    await expect(messiCard.getByTestId('rating-label')).not.toContainText('/ 5');

    const ronaldoCard = page.locator('.result-card').filter({ hasText: 'Cristiano Ronaldo' });
    await expect(ronaldoCard.getByTestId('rating-label')).toHaveText('76%');
    await expect(ronaldoCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'false');
    await expect(ronaldoCard.getByTestId('rating-star')).toHaveClass(/rating-star--muted/);

    const neymarCard = page.locator('.result-card').filter({ hasText: 'Neymar Jr' });
    await expect(neymarCard.getByTestId('rating-label')).toHaveText('90%');
    await expect(neymarCard.getByTestId('rating-star')).toHaveAttribute('data-bright', 'true');
  });

  test('shows Open original for clips with sourceUrl and omits it otherwise', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();

    const messiCard = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    const openLink = messiCard.getByTestId('open-original-link');
    await expect(openLink).toBeVisible();
    await expect(openLink).toHaveAttribute('href', 'https://example.com/videos/messi-penalty');
    await expect(openLink).toHaveAttribute('target', '_blank');
    await expect(openLink).toHaveAttribute('rel', /noopener/);

    const ronaldoCard = page.locator('.result-card').filter({ hasText: 'Cristiano Ronaldo' });
    await expect(ronaldoCard.getByTestId('open-original-link')).toHaveCount(0);
  });

  test('shows Re-process for failed clips as coach and queues submitted status', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_fail_1',
        playerId: 10,
        situation: 'Failed link ingest',
        status: 'failed',
        score: null,
        summary: '',
        comments: 'Download failed',
        errorMessage: 'Download failed',
        submittedAt: 'just now',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: null,
        sourceUrl: 'https://example.com/videos/failed-clip'
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    const card = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(card.getByTestId('open-original-link')).toHaveAttribute(
      'href',
      'https://example.com/videos/failed-clip'
    );
    await expect(card.getByTestId('reprocess-clip')).toBeVisible();
    await card.getByTestId('reprocess-clip').click();
    await expect(card.locator('.status-pending')).toBeVisible();
    await expect(card.getByTestId('reprocess-clip')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Pending' })).toBeVisible();
  });

  test('shows Re-process on complete clips with path and keeps Back', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_complete_path',
        playerId: 10,
        situation: 'Complete with stored path',
        status: 'complete',
        score: 0.8,
        summary: 'ok',
        comments: 'ok',
        submittedAt: '1 hour ago',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: { Passing: 0.8 },
        path: 'C:\\vantageiq_videos\\originals\\clip_complete_path.mp4'
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    const card = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(card.getByTestId('back-link')).toBeVisible();
    await expect(card.getByTestId('reprocess-clip')).toBeVisible();
    await expect(card.getByTestId('open-original-link')).toHaveCount(0);
  });

  test('hides Re-process when clip has neither path nor sourceUrl', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_no_media',
        playerId: 10,
        situation: 'No media refs',
        status: 'failed',
        score: null,
        summary: '',
        comments: 'failed',
        errorMessage: 'failed',
        submittedAt: 'just now',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: null
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    const card = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(card.getByTestId('reprocess-clip')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Failed' })).toBeVisible();
  });

  test('guest share S6 hides Re-process on failed clips', async ({ page }) => {
    await page.route('**/api/v1/share/*/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            player: {
              id: 10,
              name: 'Lionel Messi',
              teamName: 'U19 Prime',
              position: 'RW / LW – Winger'
            }
          }
        })
      });
    });
    await page.route('**/api/v1/share/*/clips', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 'clip_fail_guest',
            playerId: 10,
            playerName: 'Lionel Messi',
            teamName: 'U19 Prime',
            situation: 'Failed link ingest',
            status: 'failed',
            score: null,
            summary: '',
            comments: 'Download failed',
            errorMessage: 'Download failed',
            submittedAt: 'just now',
            skill: 'Passing',
            skillFocus: ['Passing'],
            skillRatings: null,
            sourceUrl: 'https://example.com/videos/failed-clip',
            segments: []
          }]
        })
      });
    });

    await page.goto('/S6-assessment-list.html?share=guest-token-demo');
    await expect(page.locator('#roleMeta')).toHaveText('Guest View');
    const card = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(card.getByTestId('open-original-link')).toBeVisible();
    await expect(card.getByTestId('reprocess-clip')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Failed' })).toBeVisible();
  });

  test('opens player dashboard from Back actions', async ({ page }) => {
    await page.getByRole('link', { name: 'Back' }).first().click();
    await expect(page).toHaveURL(/S2-player-dashboard\.html|S2-player-dashboard$/);
  });

  test('shows per-skill percent and N/A on assessed cards', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Video Assessments')).toBeVisible();

    const messiCard = page.locator('.result-card').filter({ hasText: 'Lionel Messi' });
    await expect(messiCard.getByTestId('result-skills')).toBeVisible();
    await expect(messiCard.getByTestId('result-skill-row')).toHaveCount(2);
    await expect(messiCard.getByTestId('result-skill-value').filter({ hasText: '84%' })).toHaveCount(1);
    await expect(messiCard.getByTestId('result-skill-value').filter({ hasText: 'N/A' })).toHaveCount(1);
    await expect(messiCard.getByTestId('rating-label')).toHaveText('84%');
    await expect(page.getByRole('link', { name: 'View Results' })).toHaveCount(0);

    // Catalog skill "Composure" displays as CMP; unknown "Decision-making" keeps full name.
    await expect(messiCard.locator('.result-skill-name', { hasText: 'CMP' })).toHaveAttribute('title', 'Composure');
    await expect(messiCard.locator('.result-skill-name', { hasText: 'Decision-making' })).toHaveCount(1);
  });

  test('does not force Pre-Selected Player without query params', async ({ page }) => {
    await expect(page.getByTestId('preselected-player-filter')).toBeHidden();
    await expect(page.locator('#preselectedPlayerLabel')).toBeHidden();
  });

  test('deep-link enables Pre-Selected Player and filters to that player', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html?playerId=10&playerName=' + encodeURIComponent('Lionel Messi') + '&teamName=' + encodeURIComponent('U19 Prime'));
    await expect(page.getByText('Video Assessments')).toBeVisible();
    const checkbox = page.getByTestId('preselected-player-filter');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
    // Team defaults to the deep-linked team when that option exists in the club-scoped list.
    const teamOptions = await page.locator('#teamFilter option').allTextContents();
    if (teamOptions.includes('U19 Prime')) {
      await expect(page.locator('#teamFilter')).toHaveValue('U19 Prime');
    }
    await expect(page.locator('.result-player')).toHaveCount(1);
    await expect(page.locator('.result-player')).toHaveText('Lionel Messi');

    await checkbox.uncheck();
    await page.locator('#teamFilter').selectOption('all');
    await expect(page.locator('.result-player', { hasText: 'Cristiano Ronaldo' })).toHaveCount(1);
    await expect(page.locator('.result-player', { hasText: 'Neymar Jr' })).toHaveCount(1);
  });

  test('play opens modal with first-segment media URL', async ({ page }) => {
    await page.route('**/api/v1/clips/*/media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from('fake-mp4')
      });
    });

    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_seg_1',
        playerId: 10,
        situation: 'Segment play situation',
        status: 'complete',
        score: 0.9,
        summary: 'ok',
        comments: 'ok',
        submittedAt: 'just now',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: { Passing: 0.9 },
        path: 'C:\\vantageiq_videos\\originals\\clip_seg_1.mp4',
        segments: [{ index: 0, path: 'C:\\vantageiq_videos\\segments\\clip_seg_1\\segment_000.mp4' }]
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await page.getByTestId('clip-play-button').click();
    const modal = page.getByTestId('clip-player-modal');
    await expect(modal).toHaveClass(/open/);
    const video = page.getByTestId('clip-player-video');
    await expect(video).toHaveAttribute('src', /\/api\/v1\/clips\/clip_seg_1\/media\?source=first/);

    await page.getByTestId('clip-player-close').click();
    await expect(modal).not.toHaveClass(/open/);
    await expect(video).toHaveJSProperty('src', '');
  });

  test('play falls back to original media URL when there are no segments', async ({ page }) => {
    await page.route('**/api/v1/clips/*/media**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: Buffer.from('fake-mp4')
      });
    });

    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_orig_1',
        playerId: 10,
        situation: 'Original-only play situation',
        status: 'submitted',
        score: null,
        summary: '',
        comments: null,
        submittedAt: 'just now',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: null,
        path: 'C:\\vantageiq_videos\\originals\\clip_orig_1.mp4',
        segments: []
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await page.getByTestId('clip-play-button').click();
    await expect(page.getByTestId('clip-player-modal')).toHaveClass(/open/);
    await expect(page.getByTestId('clip-player-video')).toHaveAttribute(
      'src',
      /\/api\/v1\/clips\/clip_orig_1\/media\?source=original/
    );
  });

  test('play shows unavailable when clip has no path or segments', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      store.clips = [{
        id: 'clip_none_1',
        playerId: 10,
        situation: 'No media situation',
        status: 'failed',
        score: null,
        summary: '',
        comments: null,
        errorMessage: 'failed',
        submittedAt: 'just now',
        skill: 'Passing',
        skillFocus: ['Passing'],
        skillRatings: null
      }];
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await page.getByTestId('clip-play-button').click();
    await expect(page.getByTestId('clip-player-modal')).toHaveClass(/open/);
    await expect(page.getByTestId('clip-player-unavailable')).toBeVisible();
    await expect(page.getByTestId('clip-player-unavailable')).toContainText('unavailable');
  });

  test('shows clip thumbnail when thumbnail route returns JPEG', async ({ page }) => {
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIQAxAAAADpH//Z',
      'base64'
    );

    await page.route('**/api/v1/clips/*/thumbnail', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: jpeg
      });
    });
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByTestId('clip-thumbnail').first()).toBeVisible();
    await expect(page.getByTestId('clip-play-button').first()).toBeVisible();
  });

  test('keeps placeholder when thumbnail route is missing', async ({ page }) => {
    await page.route('**/api/v1/clips/*/thumbnail', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not Found' })
      });
    });
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
    });
    await page.goto('/S6-assessment-list.html');
    await expect(page.getByTestId('clip-play-button').first()).toBeVisible();
    await expect.poll(async () => page.getByTestId('clip-thumbnail').count()).toBe(0);
    await expect(page.locator('.result-thumbnail-fallback').first()).toBeVisible();
  });

  test('Coach All Teams hides foreign-club clips and team options', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);

    await page.evaluate(() => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.clubs)) store.clubs = [];
      if (!store.clubs.some((club) => club.id === 'c_other')) {
        store.clubs.push({ id: 'c_other', name: 'Other Football Club', status: 'active' });
      }
      if (!Array.isArray(store.teams)) store.teams = [];
      if (!store.teams.some((team) => team.id === 99)) {
        store.teams.push({
          id: 99,
          name: 'Other Club United',
          ageGroup: 'U15',
          leadCoach: 'Outside Coach',
          leadCoachEmail: 'outside@example.com',
          clubId: 'c_other',
          sportId: 'sport_soccer',
          status: 'active'
        });
      }
      if (!Array.isArray(store.players)) store.players = [];
      if (!store.players.some((player) => player.id === 991)) {
        store.players.push({
          id: 991,
          name: 'Foreign Club Striker',
          normalizedName: 'foreign club striker',
          teamName: 'Other Club United',
          position: 'ST – Striker',
          trend: 'improving',
          updated: 'Updated 1h ago',
          avatarUrl: null,
          birthMonth: null,
          birthYear: 2008
        });
      }
      if (!Array.isArray(store.clips)) store.clips = [];
      store.clips.push({
        id: 'clip_foreign_1',
        playerId: 991,
        situation: 'Foreign club chance',
        status: 'complete',
        score: 0.5,
        summary: 'Outside club clip',
        comments: 'Outside club clip',
        submittedAt: '1 hour ago',
        skill: 'Finishing',
        skillFocus: ['Finishing'],
        skillRatings: { Finishing: 0.5 }
      });
      window.localStorage.setItem(key, JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Lionel Messi')).toBeVisible();
    await expect(page.getByText('Foreign Club Striker')).toHaveCount(0);
    await expect(page.locator('#teamFilter option', { hasText: 'Other Club United' })).toHaveCount(0);
    await expect(page.locator('#teamFilter option', { hasText: 'U19 Prime' })).toHaveCount(1);
  });

  test('SystemAdmin All Teams still shows foreign-club clips', async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });
    await page.goto('/S0-login.html');
    await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management/);

    await page.evaluate(() => {
      const key = 'vantageiq_mockup_v2';
      const store = JSON.parse(window.localStorage.getItem(key) || '{}');
      if (!Array.isArray(store.clubs)) store.clubs = [];
      if (!store.clubs.some((club) => club.id === 'c_other')) {
        store.clubs.push({ id: 'c_other', name: 'Other Football Club', status: 'active' });
      }
      if (!Array.isArray(store.teams)) store.teams = [];
      if (!store.teams.some((team) => team.id === 99)) {
        store.teams.push({
          id: 99,
          name: 'Other Club United',
          ageGroup: 'U15',
          leadCoach: 'Outside Coach',
          leadCoachEmail: 'outside@example.com',
          clubId: 'c_other',
          sportId: 'sport_soccer',
          status: 'active'
        });
      }
      if (!Array.isArray(store.players)) store.players = [];
      if (!store.players.some((player) => player.id === 991)) {
        store.players.push({
          id: 991,
          name: 'Foreign Club Striker',
          normalizedName: 'foreign club striker',
          teamName: 'Other Club United',
          position: 'ST – Striker',
          trend: 'improving',
          updated: 'Updated 1h ago',
          avatarUrl: null,
          birthMonth: null,
          birthYear: 2008
        });
      }
      if (!Array.isArray(store.clips)) store.clips = [];
      store.clips.push({
        id: 'clip_foreign_admin_1',
        playerId: 991,
        situation: 'Foreign club chance',
        status: 'complete',
        score: 0.5,
        summary: 'Outside club clip',
        comments: 'Outside club clip',
        submittedAt: '1 hour ago',
        skill: 'Finishing',
        skillFocus: ['Finishing'],
        skillRatings: { Finishing: 0.5 }
      });
      window.localStorage.setItem(key, JSON.stringify(store));
    });

    await page.goto('/S6-assessment-list.html');
    await expect(page.getByText('Foreign Club Striker')).toBeVisible();
    await expect(page.locator('#teamFilter option', { hasText: 'Other Club United' })).toHaveCount(1);
  });
});
