const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/playwright',
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5500',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'node scripts/serve-public.js',
      url: 'http://127.0.0.1:5501/api/v1/config',
      reuseExistingServer: true,
      timeout: 60_000
    },
    {
      command: 'node scripts/serve-mockup.js',
      url: 'http://127.0.0.1:5500/api/v1/health',
      reuseExistingServer: true,
      timeout: 60_000
    }
  ]
});
