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

module.exports = {
  uniqueTeamName,
  uniqueEmail,
  restoreCoachRole
};