import { defineConfig } from '@playwright/test';
// The perf measurement runs on its own, after the rest of the suite, so parallel workers do not skew its frame timings.
export default defineConfig({
  testDir: './tests/ui', use: { baseURL: 'http://127.0.0.1:1432', viewport: { width: 1512, height: 940 }, browserName: 'chromium' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1432', reuseExistingServer: true }, reporter: 'list',
  projects: [{ name: 'ui', testIgnore: /perf\.spec\.ts/ }, { name: 'perf', testMatch: /perf\.spec\.ts/, dependencies: ['ui'] }],
});
