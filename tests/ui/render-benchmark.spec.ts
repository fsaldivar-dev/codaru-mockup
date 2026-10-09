import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('Musaru measures real agent edits, frame gaps and interaction on a mounted editor', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/examples/performance-host.html');
  await page.waitForFunction(() => !!(window as any).renderBenchmark);
  await page.evaluate(() => (window as any).renderBenchmark.run());
  const report = await page.evaluate(() => (window as any).renderBenchmarkReport);
  expect(report.nodes).toBeGreaterThan(2000);
  expect(report.results).toHaveLength(3);
  expect(report.results.every((row: any) => row.samples.length === 5)).toBe(true);
  await mkdir('artifacts/render-performance', { recursive: true });
  await writeFile(`artifacts/render-performance/${process.env.CODARU_PERF_LABEL ?? 'current'}-chromium.json`, JSON.stringify(report, null, 2) + '\n');
  await page.getByRole('button',{name:'Recursos ARU',exact:true}).click();
  const library=page.locator('#library-slot');await expect(library.getByLabel('Colección de dibujos')).toBeVisible();
  await expect(library.getByText(/470 dibujos/)).toBeVisible();
  await page.getByRole('button',{name:'Probar estilo externo',exact:true}).click();
  await expect(library.getByLabel('Estilo del proyecto')).toHaveValue('riso-editorial');
  await expect(library.getByText('Versión móvil',{exact:true})).toBeVisible();
});
