/**
 * Shared test fixtures for the Playwright mockup suite.
 *
 * The suite runs against a long-lived dev Postgres and does NOT truncate
 * between runs. Tests that create rows use timestamped unique names so the
 * create step does not 409 on a polluted DB, and tests that mutate roles
 * snap the row back via restoreCoachRole so the next test sees a clean slate.
 */

function uniqueTeamName(base) {
  return `${base} ${Date.now()}`;
}

function uniqueEmail(localPart, domain) {
  return `${localPart}+${Date.now()}@${domain}`;
}

async function restoreCoachRole(page, email) {
  const result = await page.evaluate(async ({ email }) => {
    const actorEmail =
      window.localStorage.getItem('vantageiq_current_user_email') || 'maria@vantageiq.club';
    const response = await fetch(
      '/api/v1/users/' + encodeURIComponent(email) + '/role',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          role: 'Coach',
          actorRole: 'SystemAdmin',
          actorEmail
        })
      }
    );
    let body = null;
    try { body = await response.json(); } catch (_) { body = null; }
    return { status: response.status, body };
  }, { email });

  if (!result || result.status !== 200) {
    throw new Error(
      `restoreCoachRole(${email}) failed: ${JSON.stringify(result)}`
    );
  }

  return result;
}

/**
 * After login, SystemAdmin (and multi-club actors) may land on S0a club select.
 * Prefer c_default when present, otherwise the first eligible option.
 */
async function completeClubSelectIfNeeded(page) {
  if (!/S0a-club-select/.test(page.url())) {
    return;
  }
  const select = page.getByTestId('club-select');
  await select.waitFor({ state: 'visible' });
  const hasDefault = await select.locator('option[value="c_default"]').count();
  if (hasDefault) {
    await select.selectOption('c_default');
  } else {
    const values = await select.locator('option').evaluateAll((opts) =>
      opts.map((opt) => opt.value).filter(Boolean)
    );
    if (values.length) {
      await select.selectOption(values[0]);
    }
  }
  await page.getByTestId('club-select-submit').click();
}

module.exports = {
  uniqueTeamName,
  uniqueEmail,
  restoreCoachRole,
  completeClubSelectIfNeeded
};