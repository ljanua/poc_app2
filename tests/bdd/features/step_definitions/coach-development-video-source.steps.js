const { Given, Then, When } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');

function setError(world, status, code, message) {
  world.lastStatus = status;
  world.lastErrorCode = code;
  world.lastErrorMessage = message;
}

function normalizeWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeForDuplicateCheck(value) {
  return normalizeWhitespace(value).toLowerCase();
}

function requireCoach(world) {
  if (world.actorRole !== 'Coach') {
    setError(world, 403, 'forbidden', 'You do not have permission to perform this action.');
    return false;
  }
  return true;
}

Given('the following player development profiles exist:', function (table) {
  this.playerProfiles = new Map();
  for (const row of table.hashes()) {
    this.playerProfiles.set(row.player, {
      growthStatus: row.growthStatus,
      matchMinutes: Number(row.matchMinutes || 0),
      performanceScore: row.performanceScore ? Number(row.performanceScore) : null,
      trend: row.trend,
      missingData: row.missingData
    });
  }
});

Given('the following metric change indicators exist:', function (table) {
  this.metricChangeIndicators = new Map();
  for (const row of table.hashes()) {
    this.metricChangeIndicators.set(row.player + '|' + row.metric, {
      label: row.label,
      trend: row.trend
    });
  }
});

When('I open the development dashboard for player {string}', function (playerName) {
  this.resetResponse();
  this.dashboardCurrentPlayer = null;
  this.dashboardVisible = null;
  this.dashboardTrend = null;
  this.dashboardMissingMessage = null;
  this.dashboardMetricChanges = null;

  if (!requireCoach(this)) {
    return;
  }

  const profile = this.playerProfiles.get(playerName);
  if (!profile) {
    setError(this, 404, 'not_found', 'The selected player was not found anymore. Refresh and try again.');
    return;
  }

  this.dashboardCurrentPlayer = playerName;
  this.dashboardVisible = profile;
  this.dashboardTrend = profile.trend;
  this.dashboardMissingMessage =
    profile.missingData === 'performance' ? 'Performance metrics are not available yet.' : null;
  this.dashboardMetricChanges = {
    currentLevel: this.metricChangeIndicators.get(playerName + '|currentLevel') || null,
    fitness: this.metricChangeIndicators.get(playerName + '|fitness') || null,
    skillProgress: this.metricChangeIndicators.get(playerName + '|skillProgress') || null
  };
  this.lastStatus = 200;
});

When('I compare with player {string}', function (playerName) {
  this.dashboardComparisonPlayer = null;

  if (!this.dashboardCurrentPlayer || !this.playerProfiles.has(playerName)) {
    setError(this, 404, 'not_found', 'The selected player was not found anymore. Refresh and try again.');
    return;
  }

  this.dashboardComparisonPlayer = playerName;
  this.lastStatus = 200;
});

Then('the dashboard should show growth status {string}', function (status) {
  assert.ok(this.dashboardVisible);
  assert.equal(this.dashboardVisible.growthStatus, status);
});

Then('the dashboard should show match minutes {int}', function (minutes) {
  assert.ok(this.dashboardVisible);
  assert.equal(this.dashboardVisible.matchMinutes, minutes);
});

Then('the dashboard should show performance score {float}', function (score) {
  assert.ok(this.dashboardVisible);
  assert.equal(this.dashboardVisible.performanceScore, score);
});

Then('the dashboard should show trend indicator {string}', function (trend) {
  assert.equal(this.dashboardTrend, trend);
});

Then('the dashboard should show missing data message {string}', function (message) {
  assert.equal(this.dashboardMissingMessage, message);
});

Then(
  'the dashboard should show metric change for {string} with label {string} and trend {string}',
  function (metric, label, trend) {
    assert.ok(this.dashboardMetricChanges, 'Expected dashboard metric changes to be populated');
    const change = this.dashboardMetricChanges[metric];
    assert.ok(change, `Expected a metric change indicator for "${metric}"`);
    assert.equal(change.label, label);
    assert.equal(change.trend, trend);
  }
);

Then('the comparison should include player {string}', function (playerName) {
  assert.ok(
    this.dashboardCurrentPlayer === playerName || this.dashboardComparisonPlayer === playerName,
    `Expected ${playerName} in comparison context`
  );
});

Given('clip upload supports formats:', function (table) {
  this.supportedClipFormats = table.hashes().map((row) => row.format.toLowerCase());
});

Given('maximum clip length in seconds is {int}', function (maxSeconds) {
  this.maxClipSeconds = maxSeconds;
});

When(
  'I submit a clip with filename {string}, player {string}, situation {string}, and length {int}',
  function (filename, player, situation, lengthSeconds) {
    this.resetResponse();
    this.lastClipActionMessage = null;

    if (!requireCoach(this)) {
      return;
    }

    const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (!this.supportedClipFormats.includes(extension) || lengthSeconds > this.maxClipSeconds) {
      setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
      return;
    }

    const nextId = this.clips.length + 1;
    const clip = {
      id: nextId,
      filename,
      player,
      situation,
      lengthSeconds,
      status: 'queued',
      summary: ''
    };

    this.clips.push(clip);
    this.lastClipSubmissionId = nextId;
    this.lastStatus = 202;
  }
);

Given('the following assessed clips exist:', function (table) {
  this.clips = table.hashes().map((row) => ({
    id: Number(row.id),
    player: row.player,
    status: row.status,
    summary: row.summary || ''
  }));
  this.lastClipReviewList = [];
  this.lastClipSubmissionId = this.clips.length ? this.clips[this.clips.length - 1].id : null;
});

When(
  'assessment is completed for the latest clip with summary {string} and score {float}',
  function (summary, score) {
    const clip = this.clips.find((item) => item.id === this.lastClipSubmissionId);
    if (!clip) {
      setError(this, 404, 'not_found', 'The selected clip was not found anymore. Refresh and try again.');
      return;
    }

    clip.status = 'assessed';
    clip.summary = summary;
    clip.score = score;
    this.lastStatus = 200;
  }
);

When('assessment fails for the latest clip', function () {
  const clip = this.clips.find((item) => item.id === this.lastClipSubmissionId);
  if (!clip) {
    setError(this, 404, 'not_found', 'The selected clip was not found anymore. Refresh and try again.');
    return;
  }

  clip.status = 'failed';
  this.lastStatus = 200;
  this.lastClipActionMessage = 'Assessment failed. Try again or contact support.';
});

When('I filter clip review list by player {string} and status {string}', function (player, status) {
  this.lastClipReviewList = this.clips.filter((clip) => clip.player === player && clip.status === status);
  this.lastStatus = 200;
});

Then('the clip submission status should be {string}', function (status) {
  const clip = this.clips.find((item) => item.id === this.lastClipSubmissionId);
  assert.ok(clip);
  assert.equal(clip.status, status);
});

Then('the latest clip review should show status {string}', function (status) {
  const clip = this.clips.find((item) => item.id === this.lastClipSubmissionId);
  assert.ok(clip);
  assert.equal(clip.status, status);
});

Then('the latest clip review should show summary {string}', function (summary) {
  const clip = this.clips.find((item) => item.id === this.lastClipSubmissionId);
  assert.ok(clip);
  assert.equal(clip.summary, summary);
});

Then('review list should include clip ids:', function (table) {
  const expected = table.hashes().map((row) => Number(row.id)).sort((a, b) => a - b);
  const actual = this.lastClipReviewList.map((row) => row.id).sort((a, b) => a - b);
  assert.deepEqual(actual, expected);
});

Then('the clip action message should be {string}', function (message) {
  assert.equal(this.lastClipActionMessage, message);
});

Given('the following teams exist in source of record:', function (table) {
  this.teamsById = new Map();
  this.teamAssignments = new Map();
  for (const row of table.hashes()) {
    const id = Number(row.id);
    this.teamsById.set(id, row.name);
    this.teamAssignments.set(row.name, new Set());
  }
});

Given('the following players exist in source of record:', function (table) {
  this.playersById = new Map();
  this.catalog = [];

  for (const row of table.hashes()) {
    const id = Number(row.id);
    const player = {
      id,
      name: row.name,
      normalizedName: row.normalizedName,
      team: row.team
    };

    this.playersById.set(id, player);
    this.catalog.push(row.name);

    if (!this.teamAssignments.has(row.team)) {
      this.teamAssignments.set(row.team, new Set());
    }
    this.teamAssignments.get(row.team).add(row.name);
  }
});

When('I read players for team {string} from source of record', function (teamName) {
  this.selectedTeam = teamName;
  this.lastStatus = 200;
});

Given('I prepare add-player lookup {string} for team {string}', function (lookup, teamName) {
  this.lookup = lookup;
  this.selectedTeam = teamName;
  this.confirmNoMatch = false;
  this.confirmPreview = null;
  this.lastDuplicateQuickAction = null;
  this.lastMoveMessage = null;
  this.resetResponse();
});

When('I preview no-match create confirmation', function () {
  this.resetResponse();

  if (!requireCoach(this)) {
    return;
  }

  const normalizedName = normalizeWhitespace(this.lookup);
  const validChars = /^[A-Za-z' -]+$/;

  if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60 || !validChars.test(normalizedName)) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  this.confirmPreview = {
    team: this.selectedTeam,
    normalizedName
  };
  this.lastStatus = 200;
});

When('I submit no-match create without explicit confirmation', function () {
  this.confirmNoMatch = false;
  this.resetResponse();

  setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
});

When('I confirm no-match create explicitly', function () {
  this.confirmNoMatch = true;
});

When('I submit confirmed no-match create', function () {
  this.resetResponse();

  if (!requireCoach(this)) {
    return;
  }

  const normalizedName = normalizeWhitespace(this.lookup);
  const dedupeName = normalizeForDuplicateCheck(this.lookup);

  const duplicatePlayer = Array.from(this.playersById.values()).find(
    (player) => normalizeForDuplicateCheck(player.name) === dedupeName
  );

  if (duplicatePlayer) {
    this.lastDuplicateQuickAction = duplicatePlayer;
    setError(this, 409, 'conflict', 'A user with the same identifier already exists.');
    return;
  }

  if (!this.confirmNoMatch) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  const nextId = this.playersById.size + 100;
  const created = {
    id: nextId,
    name: normalizedName,
    normalizedName: normalizeForDuplicateCheck(normalizedName),
    team: this.selectedTeam
  };

  this.playersById.set(nextId, created);
  this.catalog.push(created.name);

  if (!this.teamAssignments.has(this.selectedTeam)) {
    this.teamAssignments.set(this.selectedTeam, new Set());
  }
  this.teamAssignments.get(this.selectedTeam).add(created.name);

  this.lastStatus = 201;
  this.lastResponseUser = created;
});

When('I assign existing matched player from duplicate quick-action', function () {
  this.resetResponse();

  const duplicatePlayer = this.lastDuplicateQuickAction;
  if (!duplicatePlayer) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  for (const [teamName, players] of this.teamAssignments.entries()) {
    if (teamName !== this.selectedTeam) {
      players.delete(duplicatePlayer.name);
    }
  }

  if (!this.teamAssignments.has(this.selectedTeam)) {
    this.teamAssignments.set(this.selectedTeam, new Set());
  }
  this.teamAssignments.get(this.selectedTeam).add(duplicatePlayer.name);

  duplicatePlayer.team = this.selectedTeam;
  this.lastStatus = 200;
});

When('I strictly move player {string} to team {string}', function (playerName, teamName) {
  this.resetResponse();

  const player = Array.from(this.playersById.values()).find((entry) => entry.name === playerName);
  if (!player) {
    setError(this, 404, 'not_found', 'The selected player was not found anymore. Refresh and try again.');
    return;
  }

  if (player.team === teamName) {
    this.lastStatus = 200;
    this.lastMoveMessage = 'Player is already assigned to this team.';
    return;
  }

  if (this.teamAssignments.has(player.team)) {
    this.teamAssignments.get(player.team).delete(player.name);
  }

  if (!this.teamAssignments.has(teamName)) {
    this.teamAssignments.set(teamName, new Set());
  }

  this.teamAssignments.get(teamName).add(player.name);
  player.team = teamName;
  this.lastStatus = 200;
  this.lastMoveMessage = 'Player moved successfully.';
});

Then('the confirmation preview should show team {string}', function (teamName) {
  assert.ok(this.confirmPreview);
  assert.equal(this.confirmPreview.team, teamName);
});

Then('the confirmation preview should show normalized player name {string}', function (normalizedName) {
  assert.ok(this.confirmPreview);
  assert.equal(this.confirmPreview.normalizedName, normalizedName);
});

Then('the duplicate quick-action should target existing player {string}', function (playerName) {
  assert.ok(this.lastDuplicateQuickAction);
  assert.equal(this.lastDuplicateQuickAction.name, playerName);
});

Then('the move operation message should be {string}', function (message) {
  assert.equal(this.lastMoveMessage, message);
});
