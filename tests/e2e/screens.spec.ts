import { test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const XLSX = fileURLToPath(new URL('../../public/demo/housing_demo.xlsx', import.meta.url));
const OUT = process.env.SHOTS;

test.skip(!OUT, 'только по запросу: SHOTS=dir');

test('screens', async ({ page }) => {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('open-excel').click();
  await (await chooser).setFiles(XLSX);
  await page.getByTestId('tab-do').click();
  await page.screenshot({ path: `${OUT}/do.png` });
  await page.getByTestId('run-all').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('assumptions-btn').click();
  const cards = page.getByTestId('card');
  const n = await cards.count();
  for (let i = 0; i < n; i++) await cards.nth(i).screenshot({ path: `${OUT}/card${String(i).padStart(2, '0')}.png` });
  await page.screenshot({ path: `${OUT}/full.png` });
  await page.getByTestId('theme-toggle').click();
  await page.screenshot({ path: `${OUT}/dark.png` });
  await page.getByTestId('cmdline').click();
  await page.keyboard.type('reg Pr');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/complete.png` });
});
