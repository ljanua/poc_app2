# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: s1-player-list.spec.js >> S1 Player List team filter and add-player flow >> keeps explicit mock-local behavior for offline regression runs
- Location: tests\playwright\s1-player-list.spec.js:118:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#playerGrid')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#playerGrid')
    14 × locator resolved to <div id="playerGrid" class="player-grid"></div>
       - unexpected value "hidden"

```

```yaml
- banner:
  - text: ⚡ VantageIQ
  - textbox "Search players, positions..."
  - text: Coach
- combobox "Filter by team":
  - option "All Teams" [selected]
- button "Add Player"
- link "Manage Teams":
  - /url: ./S3-team-management.html
- link "Admin Users":
  - /url: ./S7-admin-user-management.html
- text: Showing all assigned players.
- navigation:
  - link "👥 Players":
    - /url: ./S1-player-list.html
  - link "🧩 Teams":
    - /url: ./S3-team-management.html
  - link "📹 Capture":
    - /url: ./S4-video-capture.html
  - link "📊 My Clips":
    - /url: ./S6-assessment-list.html
- status
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | test.describe('S1 Player List team filter and add-player flow', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.addInitScript(() => {
  6   |       window.__USE_MOCK_LOCAL__ = true;
  7   |       window.__USE_BACKEND__ = false;
  8   |     });
  9   | 
  10  |     await page.goto('/S0-login.html');
  11  |     await page.evaluate(() => window.localStorage.removeItem('vantageiq_mockup_v2'));
  12  |     await page.goto('/S1-player-list.html');
> 13  |     await expect(page.locator('#playerGrid')).toBeVisible();
      |                                               ^ Error: expect(locator).toBeVisible() failed
  14  |   });
  15  | 
  16  |   test('bottom navigation routes to teams, capture, and assessments pages', async ({ page }) => {
  17  |     await page.locator('.bottom-nav .nav-item', { hasText: 'Teams' }).click();
  18  |     await expect(page).toHaveURL(/S3-team-management\.html|S3-team-management$/);
  19  | 
  20  |     await page.goto('/S1-player-list.html');
  21  |     await page.locator('.bottom-nav .nav-item', { hasText: 'Capture' }).click();
  22  |     await expect(page).toHaveURL(/S4-video-capture\.html|S4-video-capture$/);
  23  | 
  24  |     await page.goto('/S1-player-list.html');
  25  |     await page.locator('.bottom-nav .nav-item', { hasText: 'My Clips' }).click();
  26  |     await expect(page).toHaveURL(/S6-assessment-list\.html|S6-assessment-list$/);
  27  |   });
  28  | 
  29  |   test('shows only players assigned to selected team', async ({ page }) => {
  30  |     await page.selectOption('#teamFilter', 'Senior Squad');
  31  | 
  32  |     const cards = page.locator('.player-card .player-name');
  33  |     await expect(cards).toHaveCount(2);
  34  |     await expect(page.locator('.player-card .player-name', { hasText: 'Cristiano Ronaldo' })).toBeVisible();
  35  |     await expect(page.locator('.player-card .player-name', { hasText: 'Kylian Mbappe' })).toBeVisible();
  36  |     await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);
  37  | 
  38  |     await expect(page.locator('#playerListStatus')).toContainText('Senior Squad');
  39  |   });
  40  | 
  41  |   test('initializes selected team from query string when valid', async ({ page }) => {
  42  |     await page.goto('/S1-player-list.html?team=Senior%20Squad');
  43  | 
  44  |     await expect(page.locator('#teamFilter')).toHaveValue('Senior Squad');
  45  |     const cards = page.locator('.player-card .player-name');
  46  |     await expect(cards).toHaveCount(2);
  47  |     await expect(page.locator('.player-card .player-name', { hasText: 'Cristiano Ronaldo' })).toBeVisible();
  48  |     await expect(page.locator('.player-card .player-name', { hasText: 'Kylian Mbappe' })).toBeVisible();
  49  |     await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);
  50  |   });
  51  | 
  52  |   test('shows only coach-assigned teams in the dropdown for coach sessions', async ({ page }) => {
  53  |     await page.evaluate(() => window.localStorage.setItem('vantageiq_current_user_email', 'joao@vantageiq.club'));
  54  |     await page.reload();
  55  | 
  56  |     await expect(page.locator('#teamFilter option')).toHaveCount(2);
  57  |     await expect(page.locator('#teamFilter')).toContainText('All Teams');
  58  |     await expect(page.locator('#teamFilter')).toContainText('U19 Prime');
  59  |     await expect(page.locator('#teamFilter')).not.toContainText('Senior Squad');
  60  |   });
  61  | 
  62  |   test('shows all available teams in the dropdown for system admin sessions', async ({ page }) => {
  63  |     await page.evaluate(() => window.localStorage.setItem('vantageiq_current_user_email', 'maria@vantageiq.club'));
  64  |     await page.reload();
  65  | 
  66  |     await expect(page.locator('#teamFilter option')).toHaveCount(4);
  67  |     await expect(page.locator('#teamFilter')).toContainText('All Teams');
  68  |     await expect(page.locator('#teamFilter')).toContainText('U17 Elite');
  69  |     await expect(page.locator('#teamFilter')).toContainText('U19 Prime');
  70  |     await expect(page.locator('#teamFilter')).toContainText('Senior Squad');
  71  |   });
  72  | 
  73  |   test('falls back to all teams when query string team is invalid', async ({ page }) => {
  74  |     await page.goto('/S1-player-list.html?team=Unknown%20Team');
  75  | 
  76  |     await expect(page.locator('#teamFilter')).toHaveValue('all');
  77  |     await expect(page.locator('.player-card .player-name')).toHaveCount(4);
  78  |     await expect(page.locator('#playerListStatus')).toContainText('Showing all assigned players');
  79  |   });
  80  | 
  81  |   test('adds a player from name lookup and reassigns to selected team', async ({ page }) => {
  82  |     await page.selectOption('#teamFilter', 'Senior Squad');
  83  |     await page.getByRole('button', { name: 'Add Player' }).click();
  84  | 
  85  |     await page.fill('#addPlayerInput', 'ney');
  86  |     await page.fill('#addPlayerInput', 'Neymar Jr');
  87  |     await page.getByRole('button', { name: 'Add to Team' }).click();
  88  | 
  89  |     await expect(page.locator('#toast')).toContainText('Neymar Jr moved to Senior Squad.');
  90  |     await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toBeVisible();
  91  | 
  92  |     await page.selectOption('#teamFilter', 'U17 Elite');
  93  |     await expect(page.locator('.player-card .player-name', { hasText: 'Neymar Jr' })).toHaveCount(0);
  94  |     await expect(page.locator('#emptyState')).toBeVisible();
  95  |   });
  96  | 
  97  |   test('blocks add action when no valid dropdown match exists', async ({ page }) => {
  98  |     await page.selectOption('#teamFilter', 'U19 Prime');
  99  |     await page.getByRole('button', { name: 'Add Player' }).click();
  100 | 
  101 |     await page.fill('#addPlayerInput', 'zzz');
  102 |     await expect(page.locator('#addPlayerHint')).toContainText('No exact match found. Confirm create-on-no-match before submit.');
  103 |     await expect(page.locator('#createConfirm')).toBeChecked();
  104 | 
  105 |     await page.locator('#createConfirm').uncheck();
  106 |     await page.getByRole('button', { name: 'Add to Team' }).click();
  107 |     await expect(page.locator('#addPlayerHint')).toContainText('Choose a player from the dropdown matches.');
  108 |   });
  109 | 
  110 |   test('requires selecting a specific team before add-player suggestions are enabled', async ({ page }) => {
  111 |     await page.selectOption('#teamFilter', 'all');
  112 |     await page.getByRole('button', { name: 'Add Player' }).click();
  113 | 
```