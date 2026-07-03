const { Given, Then, When } = require('@cucumber/cucumber');
const assert = require('node:assert/strict');

function setError(world, status, code, message) {
  world.lastStatus = status;
  world.lastErrorCode = code;
  world.lastErrorMessage = message;
  world.lastResponseUser = null;
}

function requireSystemAdmin(world) {
  if (world.actorRole !== 'SystemAdmin') {
    setError(world, 403, 'forbidden', 'You do not have permission to perform this action.');
    return false;
  }
  return true;
}

Given('the following users exist:', function (table) {
  for (const row of table.hashes()) {
    this.users.set(row.email, {
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      password: 'SecurePass123'
    });
  }
});

Given('I am authenticated as {string}', function (role) {
  this.actorRole = role;
  this.activeToken = `jwt-${role.toLowerCase()}`;
  this.tokenExpired = false;
  this.resetResponse();
});

Given('no token is currently active', function () {
  this.actorRole = null;
  this.activeToken = null;
  this.tokenExpired = false;
  this.resetResponse();
});

Given('my token is expired', function () {
  this.tokenExpired = true;
});

When(
  'I create a user with name {string}, email {string}, role {string}, and password {string}',
  function (name, email, role, password) {
    this.resetResponse();
    if (!requireSystemAdmin(this)) return;

    if (!name.trim() || !email.includes('@') || !['SystemAdmin', 'Coach'].includes(role) || password.length < 10) {
      setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
      return;
    }

    if (this.users.has(email)) {
      setError(this, 409, 'conflict', 'A user with the same identifier already exists.');
      return;
    }

    const created = {
      name,
      email,
      role,
      status: 'active',
      password
    };

    this.users.set(email, created);
    this.lastStatus = 201;
    this.lastResponseUser = created;
  }
);

When('I change role for email {string} to {string}', function (email, role) {
  this.resetResponse();
  if (!requireSystemAdmin(this)) return;

  const user = this.users.get(email);
  if (!user) {
    setError(this, 404, 'not_found', 'The selected user was not found anymore. Refresh and try again.');
    return;
  }

  if (!['SystemAdmin', 'Coach'].includes(role)) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  user.role = role;
  this.users.set(email, user);
  this.lastStatus = 200;
  this.lastResponseUser = user;
});

When('I change password for email {string} to {string} and confirm {string}', function (email, newPassword, confirmPassword) {
  this.resetResponse();
  if (!requireSystemAdmin(this)) return;

  const user = this.users.get(email);
  if (!user) {
    setError(this, 404, 'not_found', 'The selected user was not found anymore. Refresh and try again.');
    return;
  }

  const hasNumber = /\d/.test(newPassword);
  if (newPassword.length < 10 || !hasNumber || newPassword !== confirmPassword) {
    setError(this, 400, 'validation_error', 'Please review the form fields and try again.');
    return;
  }

  user.password = newPassword;
  this.users.set(email, user);
  this.lastStatus = 204;
  this.lastResponseUser = user;
});

When('I deactivate user with email {string}', function (email) {
  this.resetResponse();
  if (!requireSystemAdmin(this)) return;

  const user = this.users.get(email);
  if (!user) {
    setError(this, 404, 'not_found', 'The selected user was not found anymore. Refresh and try again.');
    return;
  }

  user.status = 'inactive';
  this.users.set(email, user);
  this.lastStatus = 200;
  this.lastResponseUser = user;
});

When('user {string} logs in with password {string}', function (email, password) {
  this.resetResponse();
  const user = this.users.get(email);
  if (!user || user.status !== 'active' || user.password !== password) {
    setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
    return;
  }

  this.actorRole = user.role;
  this.activeToken = `jwt-${user.role.toLowerCase()}`;
  this.tokenExpired = false;
  this.lastStatus = 200;
  this.lastResponseUser = user;
});

When('I request a protected resource', function () {
  this.resetResponse();

  if (!this.activeToken || this.tokenExpired) {
    setError(this, 403, 'forbidden', 'You do not have permission to perform this action.');
    return;
  }

  this.lastStatus = 200;
});

Then('the operation status should be {int}', function (status) {
  assert.equal(this.lastStatus, status);
});

Then('the response should include user {string} with role {string}', function (email, role) {
  assert.ok(this.lastResponseUser);
  assert.equal(this.lastResponseUser.email, email);
  assert.equal(this.lastResponseUser.role, role);
});

Then('the response should include user {string} with status {string}', function (email, status) {
  assert.ok(this.lastResponseUser);
  assert.equal(this.lastResponseUser.email, email);
  assert.equal(this.lastResponseUser.status, status);
});

Then('the API error code should be {string}', function (code) {
  assert.equal(this.lastErrorCode, code);
});

Then('the API error message should be {string}', function (message) {
  assert.equal(this.lastErrorMessage, message);
});

Then('a JWT token should be issued', function () {
  assert.ok(this.activeToken);
});
