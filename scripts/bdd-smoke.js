const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`BDD smoke failed: ${message}`);
  process.exit(1);
}

function ensureExists(target, label) {
  if (!fs.existsSync(target)) {
    fail(`${label} missing at ${target}`);
  }
}

function ensureFiles(folder, extension, label) {
  const entries = fs.readdirSync(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name);

  if (files.length === 0) {
    fail(`no ${label} found in ${folder}`);
  }

  return files;
}

const root = process.cwd();
const featureDir = path.join(root, 'tests', 'bdd', 'features');
const supportDir = path.join(featureDir, 'support');
const stepDir = path.join(featureDir, 'step_definitions');
const cucumberConfig = path.join(root, 'cucumber.json');

ensureExists(cucumberConfig, 'cucumber config');
ensureExists(featureDir, 'feature directory');
ensureExists(supportDir, 'support directory');
ensureExists(stepDir, 'step definition directory');

ensureFiles(featureDir, '.feature', 'feature files');
ensureFiles(supportDir, '.js', 'support JS files');
ensureFiles(stepDir, '.js', 'step definition JS files');

try {
  require.resolve('@cucumber/cucumber/package.json');
} catch {
  fail('dependency @cucumber/cucumber is not installed. Run npm install.');
}

console.log('BDD smoke passed: feature, step, support, and dependency checks are valid.');
