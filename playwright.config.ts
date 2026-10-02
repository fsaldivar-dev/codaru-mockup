import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/ui', use: { baseURL: 'http://127.0.0.1:1432', viewport: { width: 1512, height: 940 }, browserName: 'chromium' }, webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1432', reuseExistingServer: true }, reporter: 'list' });
