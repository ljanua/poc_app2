const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/playwright',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5500',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/serve-mockup.js',
    url: 'http://127.0.0.1:5500',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
