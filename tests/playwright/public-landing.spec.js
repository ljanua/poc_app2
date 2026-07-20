const { test, expect } = require('@playwright/test');

const PUBLIC = 'http://127.0.0.1:5501';
const APP = 'http://127.0.0.1:5500';

test.describe('Public landing (share-first)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PUBLIC + '/');
    await page.evaluate(() => {
      window.localStorage.removeItem('vantageiq_mockup_v2');
      window.localStorage.removeItem('vantageiq_active_club');
    });
    await page.goto(PUBLIC + '/');
  });

  test('serves marketing landing at public / with dual doors and proof', async ({ page }) => {
    await expect(page.getByTestId('landing-hero')).toBeVisible();
    await expect(page.getByTestId('brand-logo')).toBeVisible();
    await expect(page.getByTestId('door-parent')).toBeVisible();
    await expect(page.getByTestId('door-coach')).toBeVisible();
    await expect(page.getByTestId('landing-proof')).toBeVisible();
    await expect(page.getByTestId('ai-mention')).toBeVisible();
    await expect(page.getByTestId('free-to-start')).toBeVisible();
    await expect(page.getByText('Mockup Flow')).toHaveCount(0);
  });

  test('parent door shows ask-coach message without signup', async ({ page }) => {
    await page.getByTestId('door-parent').click();
    await expect(page.getByTestId('panel-parent')).toBeVisible();
    await expect(page.getByTestId('ask-coach-message')).toBeVisible();
    await expect(page.getByTestId('copy-ask-coach')).toBeVisible();
    await expect(page.getByTestId('panel-coach')).toBeHidden();
  });

  test('coach signup email field matches page input styles', async ({ page }) => {
    await page.getByTestId('door-coach').click();
    await expect(page.getByTestId('signup-email')).toBeVisible();
    await expect(page.getByTestId('signup-email')).toHaveAttribute('type', 'email');

    const emailStyles = await page.getByTestId('signup-email').evaluate((el) => {
      const s = getComputedStyle(el);
      return { padding: s.padding, borderRadius: s.borderRadius, backgroundColor: s.backgroundColor };
    });
    const passwordStyles = await page.getByTestId('signup-password').evaluate((el) => {
      const s = getComputedStyle(el);
      return { padding: s.padding, borderRadius: s.borderRadius, backgroundColor: s.backgroundColor };
    });
    const nameStyles = await page.getByTestId('signup-name').evaluate((el) => {
      const s = getComputedStyle(el);
      return { padding: s.padding, borderRadius: s.borderRadius, backgroundColor: s.backgroundColor };
    });
    expect(emailStyles).toEqual(passwordStyles);
    expect(emailStyles).toEqual(nameStyles);
  });

  test('coach signup creates pending account and does not enter app', async ({ page }) => {
    await page.getByTestId('door-coach').click();
    await expect(page.getByTestId('panel-coach')).toBeVisible();
    await expect(page.getByTestId('signup-form')).toBeVisible();
    await expect(page.getByTestId('signup-tier')).toBeVisible();
    await expect(page.getByTestId('sign-in-link')).toHaveAttribute('href', /public-signin/);

    const stamp = Date.now();
    const email = `free.coach.${stamp}@example.com`;
    await page.getByTestId('signup-tier').selectOption('free');
    await page.getByTestId('signup-name').fill(`Free Coach ${stamp}`);
    await page.getByTestId('signup-email').fill(email);
    await page.getByTestId('signup-password').fill('SecurePass123');
    await page.getByTestId('signup-team-name').fill(`Free Team ${stamp}`);
    await page.getByTestId('signup-submit').click();

    await page.waitForURL(/pending/);
    await expect(page.getByTestId('pending-title')).toBeVisible();
  });

  test('app / redirects to public origin', async ({ request }) => {
    const res = await request.get(APP + '/', { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const location = res.headers().location || '';
    expect(location).toMatch(/5501|PUBLIC/);
  });

  test('public sign-in offers password and OAuth providers', async ({ page }) => {
    await page.goto(PUBLIC + '/public-signin.html');
    await expect(page.getByTestId('public-signin-form')).toBeVisible();
    await expect(page.getByTestId('signin-auth-method')).toBeVisible();
    await expect(page.getByTestId('signin-auth-method').locator('option[value="password"]')).toHaveCount(1);
    await expect(page.getByTestId('signin-auth-method').locator('option[value="google"]')).toHaveCount(1);
    await expect(page.getByTestId('signin-auth-method').locator('option[value="apple"]')).toHaveCount(1);
    await expect(page.getByTestId('signin-auth-method').locator('option[value="facebook"]')).toHaveCount(1);

    await page.getByTestId('signin-auth-method').selectOption('google');
    await expect(page.getByTestId('password-fields')).toBeHidden();
    await page.getByTestId('signin-submit').click();
    await page.waitForURL(/oauth-stub/);
    expect(page.url()).toMatch(/mode=login/);
    expect(page.url()).toMatch(/provider=google/);
  });
});
