const { Given, Then, When } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getSuggestions(world) {
  const selectedTeam = world.selectedTeam;
  const query = normalize(world.lookup);

  if (!selectedTeam || selectedTeam === 'all') {
    return [];
  }

  return world.catalog.filter((name) => {
    const alreadyInTeam = world.teamAssignments.get(selectedTeam).has(name);
    if (alreadyInTeam) {
      return false;
    }

    if (!query) {
      return true;
    }

    return normalize(name).includes(query);
  });
}

function removePlayerFromOtherTeams(world, playerName, targetTeam) {
  for (const [team, players] of world.teamAssignments.entries()) {
    if (team === targetTeam) {
      continue;
    }
    players.delete(playerName);
  }
}

Given('the following players are assigned to teams:', function (table) {
  this.teamAssignments = new Map();
  for (const row of table.hashes()) {
    const team = row.team;
    const name = row.name;
    if (!this.teamAssignments.has(team)) {
      this.teamAssignments.set(team, new Set());
    }
    this.teamAssignments.get(team).add(name);
  }

  if (!this.teamAssignments.has('U17 Elite')) this.teamAssignments.set('U17 Elite', new Set());
  if (!this.teamAssignments.has('U19 Prime')) this.teamAssignments.set('U19 Prime', new Set());
  if (!this.teamAssignments.has('Senior Squad')) this.teamAssignments.set('Senior Squad', new Set());

  this.selectedTeam = 'all';
  this.lookup = '';
  this.lastSuggestions = [];
  this.lastAddError = null;
});

Given('the player catalog includes:', function (table) {
  this.catalog = table.hashes().map((row) => row.name);
});

When('I select team {string}', function (teamName) {
  this.selectedTeam = teamName;
  if (!this.teamAssignments.has(teamName) && teamName !== 'all') {
    this.teamAssignments.set(teamName, new Set());
  }
});

When('I type player lookup {string}', function (lookupText) {
  this.lookup = lookupText;
  this.lastSuggestions = getSuggestions(this);
});

When('I add player {string} to the selected team', function (playerName) {
  this.lastAddError = null;
  const selectedTeam = this.selectedTeam;

  if (!selectedTeam || selectedTeam === 'all') {
    this.lastAddError = 'Pick a team before adding players.';
    return;
  }

  const exactMatch = getSuggestions(this).find((candidate) => normalize(candidate) === normalize(playerName));
  if (!exactMatch) {
    this.lastAddError = 'Choose a player from the dropdown matches.';
    return;
  }

  removePlayerFromOtherTeams(this, exactMatch, selectedTeam);
  this.teamAssignments.get(selectedTeam).add(exactMatch);
  this.lookup = '';
  this.lastSuggestions = getSuggestions(this);
});

When('I try to add from current lookup', function () {
  this.lastAddError = null;
  const selectedTeam = this.selectedTeam;

  if (!selectedTeam || selectedTeam === 'all') {
    this.lastAddError = 'Pick a team before adding players.';
    return;
  }

  const exactMatch = getSuggestions(this).find((candidate) => normalize(candidate) === normalize(this.lookup));
  if (!exactMatch) {
    this.lastAddError = 'Choose a player from the dropdown matches.';
    return;
  }

  removePlayerFromOtherTeams(this, exactMatch, selectedTeam);
  this.teamAssignments.get(selectedTeam).add(exactMatch);
  this.lookup = '';
  this.lastSuggestions = getSuggestions(this);
});

Then('visible players should be:', function (table) {
  const expected = table.hashes().map((row) => row.name).sort();
  const selectedTeam = this.selectedTeam;

  let actual;
  if (selectedTeam === 'all') {
    actual = [];
    for (const players of this.teamAssignments.values()) {
      actual.push(...Array.from(players));
    }
    actual = Array.from(new Set(actual)).sort();
  } else {
    actual = Array.from(this.teamAssignments.get(selectedTeam) || []).sort();
  }

  assert.deepEqual(actual, expected);
});

Then('matching suggestions should include:', function (table) {
  const expected = table.hashes().map((row) => row.name).sort();
  const actual = this.lastSuggestions.slice().sort();

  for (const name of expected) {
    assert.ok(actual.includes(name), `Expected suggestion ${name} in ${actual.join(', ')}`);
  }
});

Then('there should be no matching suggestions', function () {
  assert.equal(this.lastSuggestions.length, 0);
});

Then('team {string} should include player {string}', function (teamName, playerName) {
  const teamPlayers = this.teamAssignments.get(teamName) || new Set();
  assert.ok(teamPlayers.has(playerName));
});

Then('team {string} should not include player {string}', function (teamName, playerName) {
  const teamPlayers = this.teamAssignments.get(teamName) || new Set();
  assert.equal(teamPlayers.has(playerName), false);
});

Then('add operation should be rejected with message {string}', function (message) {
  assert.equal(this.lastAddError, message);
});
