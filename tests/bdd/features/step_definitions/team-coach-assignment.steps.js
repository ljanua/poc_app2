const { Given, Then, When } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');

function setError(world, status, code, message) {
  world.lastStatus = status;
  world.lastErrorCode = code;
  world.lastErrorMessage = message;
  world.lastResponseTeam = null;
}

function normalizeTeamName(value) {
  return String(value || '').trim().toLowerCase();
}

function getUser(world, email) {
  return world.users.get(email) || null;
}

function isEligibleCoach(user) {
  return Boolean(user && user.role === 'Coach' && user.status === 'active');
}

function findTeamByName(world, teamName) {
  const key = normalizeTeamName(teamName);
  for (const team of world.teams.values()) {
    if (normalizeTeamName(team.name) === key) {
      return team;
    }
  }
  return null;
}

Given('I am authenticated as {string} with email {string}', function (role, email) {
  this.actorRole = role;
  this.actorEmail = email;
  this.activeToken = `jwt-${role.toLowerCase()}`;
  this.tokenExpired = false;
  this.resetResponse();
});

Given('the following teams with lead coaches exist:', function (table) {
  this.teams = new Map();

  for (const row of table.hashes()) {
    this.teams.set(row.name, {
      name: row.name,
      ageGroup: row.ageGroup,
      leadCoachEmail: row.leadCoachEmail
    });
  }
});

When('I create a team named {string} in age group {string}', function (teamName, ageGroup) {
  this.resetResponse();

  if (!this.actorRole || !this.actorEmail) {
    setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
    return;
  }

  if (findTeamByName(this, teamName)) {
    setError(this, 409, 'conflict', 'A user with the same identifier already exists.');
    return;
  }

  if (this.actorRole === 'Coach') {
    const actor = getUser(this, this.actorEmail);
    if (!isEligibleCoach(actor)) {
      setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
      return;
    }

    const created = {
      name: teamName,
      ageGroup,
      leadCoachEmail: this.actorEmail
    };
    this.teams.set(teamName, created);
    this.lastResponseTeam = created;
    this.lastStatus = 201;
    return;
  }

  if (this.actorRole === 'SystemAdmin') {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
});

When(
  'I create a team named {string} in age group {string} selecting coach email {string}',
  function (teamName, ageGroup, coachEmail) {
    this.resetResponse();

    if (!this.actorRole || !this.actorEmail) {
      setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
      return;
    }

    if (findTeamByName(this, teamName)) {
      setError(this, 409, 'conflict', 'A user with the same identifier already exists.');
      return;
    }

    if (this.actorRole === 'Coach') {
      const actor = getUser(this, this.actorEmail);
      if (!isEligibleCoach(actor)) {
        setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
        return;
      }

      const created = {
        name: teamName,
        ageGroup,
        leadCoachEmail: this.actorEmail
      };
      this.teams.set(teamName, created);
      this.lastResponseTeam = created;
      this.lastStatus = 201;
      return;
    }

    if (this.actorRole !== 'SystemAdmin') {
      setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
      return;
    }

    const selectedCoach = getUser(this, coachEmail);
    if (!isEligibleCoach(selectedCoach)) {
      setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
      return;
    }

    const created = {
      name: teamName,
      ageGroup,
      leadCoachEmail: coachEmail
    };
    this.teams.set(teamName, created);
    this.lastResponseTeam = created;
    this.lastStatus = 201;
  }
);

When('I reassign team {string} to coach email {string}', function (teamName, coachEmail) {
  this.resetResponse();

  if (this.actorRole !== 'SystemAdmin') {
    setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
    return;
  }

  const team = findTeamByName(this, teamName);
  if (!team) {
    setError(this, 404, 'not_found', 'The selected team was not found anymore. Refresh and try again.');
    return;
  }

  const selectedCoach = getUser(this, coachEmail);
  if (!isEligibleCoach(selectedCoach)) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  team.leadCoachEmail = coachEmail;
  this.teams.set(team.name, team);
  this.lastResponseTeam = team;
  this.lastStatus = 200;
});

When('I list teams from source of record', function () {
  this.lastTeamList = Array.from(this.teams.values()).map((team) => ({
    name: team.name,
    ageGroup: team.ageGroup,
    leadCoachEmail: team.leadCoachEmail
  }));
  this.lastStatus = 200;
});

Then('team {string} should have lead coach email {string}', function (teamName, coachEmail) {
  const team = findTeamByName(this, teamName);
  assert.ok(team, `Expected team ${teamName} to exist`);
  assert.equal(team.leadCoachEmail, coachEmail);
});

Then('team {string} should not exist', function (teamName) {
  const team = findTeamByName(this, teamName);
  assert.equal(team, null);
});

Then('listed teams should include:', function (table) {
  const expected = table.hashes();

  for (const row of expected) {
    const found = this.lastTeamList.find(
      (team) => normalizeTeamName(team.name) === normalizeTeamName(row.name)
    );

    assert.ok(found, `Expected team ${row.name} in listed teams`);
    assert.equal(found.leadCoachEmail, row.leadCoachEmail);
  }
});
