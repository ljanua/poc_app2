const { test, expect } = require('@playwright/test');

test.describe('S10 Games + Match History Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__USE_MOCK_LOCAL__ = true;
      window.__USE_BACKEND__ = false;
    });

    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
    });
    await page.fill('#email', 'joao@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$/);
  });

  test('creates a fixture and completes a Game Sheet with starters (AE1)', async ({ page }) => {
    await page.goto('/S10-games.html');
    await expect(page.getByTestId('games-list-view')).toBeVisible();

    await page.getByTestId('create-game-button').click();
    await page.getByTestId('game-opponent').fill('Rivals FC');
    await page.getByTestId('game-kickoff').fill('2026-07-18T15:00');
    await page.getByTestId('game-home-away').selectOption('home');
    await page.getByTestId('game-duration').fill('90');
    await page.getByTestId('create-game-submit').click();

    await expect(page.getByTestId('game-row').first()).toContainText('Rivals FC');
    await page.getByTestId('open-game-sheet').first().click();
    await expect(page.getByTestId('game-sheet-view')).toBeVisible();

    const starterChecks = page.locator('.starter-check');
    const starterCount = await starterChecks.count();
    expect(starterCount).toBeGreaterThanOrEqual(1);
    const limit = Math.min(starterCount, 11);
    for (let i = 0; i < limit; i += 1) {
      await starterChecks.nth(i).check();
    }

    const firstStarterId = await starterChecks.first().getAttribute('value');
    await page.getByTestId('rating-' + firstStarterId).fill('7');
    await page.getByTestId('save-game-sheet').click();
    await expect(page.getByTestId('preview-minutes-' + firstStarterId)).toHaveText('90');

    const rollup = await page.evaluate((playerId) => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      const stats = store.playerStats && store.playerStats[playerId];
      const history = window.MockupApi.listMatchHistory(playerId);
      return {
        totalMinutes: stats && stats.totalMinutes,
        events: (history && history.events) || []
      };
    }, firstStarterId);

    expect(rollup.totalMinutes).toBeGreaterThanOrEqual(90);
    expect(rollup.events.length).toBeGreaterThanOrEqual(1);
    expect(rollup.events[0].opponent).toBe('Rivals FC');
    expect(rollup.events[0].minutes).toBe(90);

    await page.goto('/S2-player-dashboard.html?player=' + encodeURIComponent('Lionel Messi'));
    // Open Match History for whatever starter was rated if it was Messi; otherwise use evaluate path above.
    const messiId = await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      const messi = (store.players || []).find((p) => p.name === 'Lionel Messi');
      return messi ? String(messi.id) : null;
    });
    if (String(firstStarterId) === String(messiId)) {
      await page.getByTestId('dashboard-section-toggle-match-history').click();
      await expect(page.getByTestId('match-history-event').first()).toBeVisible();
      await expect(page.getByTestId('match-history-opponent').first()).toHaveText('Rivals FC');
      await expect(page.getByTestId('match-history-minutes').first()).toHaveText("90'");
    }
  });

  test('substitution timeline splits minutes A→B at 60 (AE2)', async ({ page }) => {
    await page.goto('/S10-games.html');

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      const onTeam = (store.players || []).filter((p) => p.teamName === 'U19 Prime');
      if (onTeam.length < 2) {
        store.players.push({
          id: 901,
          name: 'Bench Player',
          normalizedName: 'bench player',
          teamName: 'U19 Prime',
          position: 'CM – Central Midfielder',
          trend: 'plateau',
          updated: 'Updated just now'
        });
        window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
      }
    });

    const result = await page.evaluate(() => {
      const teams = window.MockupApi.listTeams() || [];
      const u19 = teams.find((t) => t.name === 'U19 Prime');
      const created = window.MockupApi.createGame({
        teamId: String(u19.id),
        kickoffAt: new Date('2026-07-19T16:00:00').toISOString(),
        opponent: 'Sub Test FC',
        homeAway: 'home',
        durationMinutes: 90
      });
      const gameId = created.game && created.game.id;
      const detail = window.MockupApi.getGame(gameId);
      const roster = (detail.data && detail.data.roster) || [];
      const outId = String(roster[0].id);
      const inId = String(roster[1].id);
      const saved = window.MockupApi.saveGameSheet(gameId, {
        starters: [outId],
        substitutions: [{ minute: 60, playerOutId: outId, playerInId: inId }],
        ratings: [
          { playerId: outId, rating: 7 },
          { playerId: inId, rating: 6.5 }
        ]
      });
      return {
        status: saved.status,
        minutes: saved.data && saved.data.minutesByPlayer,
        outId,
        inId,
        gameId
      };
    });

    expect(result.status).toBe(200);
    expect(result.minutes[result.outId]).toBe(60);
    expect(result.minutes[result.inId]).toBe(30);

    await page.goto('/S10-games.html?gameId=' + encodeURIComponent(result.gameId));
    await expect(page.getByTestId('game-sheet-view')).toBeVisible();
    await expect(page.getByTestId('preview-minutes-' + result.outId)).toHaveText('60');
    await expect(page.getByTestId('preview-minutes-' + result.inId)).toHaveText('30');
    await expect(page.getByTestId('rating-' + result.outId)).toHaveValue('7');
    await expect(page.getByTestId('rating-' + result.inId)).toHaveValue('6.5');
  });

  test('Games nav is present for coach', async ({ page }) => {
    await page.goto('/S1-player-list.html');
    await expect(page.getByTestId('nav-games')).toBeVisible();
    await page.getByTestId('nav-games').click();
    await expect(page).toHaveURL(/S10-games\.html/);
  });

  test('Coach Joao defaults Team filter to lead team U19 Prime (AE1)', async ({ page }) => {
    await page.goto('/S10-games.html');
    await expect(page.getByTestId('games-list-view')).toBeVisible();

    const selected = page.getByTestId('games-team-filter');
    await expect(selected.locator('option:checked')).toHaveText('U19 Prime');

    const selectedId = await selected.inputValue();
    const expectedId = await page.evaluate(() => {
      const teams = window.MockupApi.listTeams() || [];
      const u19 = teams.find((t) => t.name === 'U19 Prime');
      return u19 ? String(u19.id) : null;
    });
    expect(selectedId).toBe(expectedId);
  });

  test('SystemAdmin defaults Team filter to first list team (not U19 hardcode)', async ({ page }) => {
    const { completeClubSelectIfNeeded } = require('./_fixture-utils');
    await page.goto('/S0-login.html');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_active_club_id');
    });
    await page.fill('#email', 'maria@vantageiq.club');
    await page.fill('#password', 'SecurePass123');
    await page.locator('#loginForm button[type="submit"]').click();
    await page.waitForURL(/S1-player-list|S7-admin-user-management|S0a-club-select/);
    await completeClubSelectIfNeeded(page);
    await expect(page).toHaveURL(/S1-player-list\.html|S1-player-list$|S7-admin-user-management/);

    await page.goto('/S10-games.html');
    await expect(page.getByTestId('games-list-view')).toBeVisible();

    const expected = await page.evaluate(() => {
      const teams = window.MockupApi.listTeams() || [];
      return teams[0] ? { id: String(teams[0].id), name: teams[0].name } : null;
    });
    expect(expected).not.toBeNull();

    const selected = page.getByTestId('games-team-filter');
    await expect(selected.locator('option:checked')).toHaveText(expected.name);
    expect(await selected.inputValue()).toBe(expected.id);
  });

  test('Coach with no lead teams selects first option without throw (AE2)', async ({ page }) => {
    await page.goto('/S10-games.html');
    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      (store.teams || []).forEach((team) => {
        team.leadCoachEmail = 'other@vantageiq.club';
        team.leadCoach = 'Other Coach';
      });
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    await page.goto('/S10-games.html');
    await expect(page.getByTestId('games-list-view')).toBeVisible();

    const selected = page.getByTestId('games-team-filter');
    const firstOption = selected.locator('option').first();
    await expect(selected.locator('option:checked')).toHaveText(await firstOption.textContent());
  });

  test('Create Duration presets from team sport (AE4)', async ({ page }) => {
    await page.goto('/S10-games.html');
    await page.getByTestId('create-game-button').click();
    await expect(page.getByTestId('game-duration')).toHaveValue('90');
  });

  test('Game Sheet blocks more starters than sport numberOfPlayers (AE5)', async ({ page }) => {
    await page.goto('/S10-games.html');

    await page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem('vantageiq_mockup_v2'));
      const sport = (store.sports || []).find((s) => s.id === 'sport_soccer');
      if (sport) sport.numberOfPlayers = 2;
      const onTeam = (store.players || []).filter((p) => p.teamName === 'U19 Prime');
      while (onTeam.length < 3) {
        const id = 910 + onTeam.length;
        const player = {
          id: id,
          name: 'Starter Cap ' + id,
          normalizedName: 'starter cap ' + id,
          teamName: 'U19 Prime',
          position: 'CM – Central Midfielder',
          trend: 'plateau',
          updated: 'Updated just now'
        };
        store.players.push(player);
        onTeam.push(player);
      }
      window.localStorage.setItem('vantageiq_mockup_v2', JSON.stringify(store));
    });

    const gameId = await page.evaluate(() => {
      const teams = window.MockupApi.listTeams() || [];
      const u19 = teams.find((t) => t.name === 'U19 Prime');
      const created = window.MockupApi.createGame({
        teamId: String(u19.id),
        kickoffAt: new Date('2026-07-20T16:00:00').toISOString(),
        opponent: 'Cap Test FC',
        homeAway: 'home',
        durationMinutes: 90
      });
      return created.game && created.game.id;
    });

    await page.goto('/S10-games.html?gameId=' + encodeURIComponent(gameId));
    await expect(page.getByTestId('game-sheet-view')).toBeVisible();

    const starterChecks = page.locator('.starter-check');
    const count = await starterChecks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await starterChecks.nth(0).check();
    await starterChecks.nth(1).check();
    await starterChecks.nth(2).click();
    await expect(starterChecks.nth(2)).not.toBeChecked();
    await expect(page.getByTestId('games-error')).toContainText('At most 2 starters');
  });
});
