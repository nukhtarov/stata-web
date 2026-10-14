import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const XLSX = fileURLToPath(new URL('../../public/demo/housing_demo.xlsx', import.meta.url));
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function load(page: Page) {
  await page.goto('./');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('open-excel').click();
  await (await chooser).setFiles(XLSX);
  await expect(page.getByTestId('variables')).toContainText('Mortgage_PC');
}

test('загрузка Excel через кнопку', async ({ page }) => {
  await load(page);
  await expect(page.getByTestId('card').first()).toContainText('(20 vars, 48 obs)');
});

test('кнопка «Пример данных»', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('open-demo').click();
  await expect(page.getByTestId('variables')).toContainText('Mortgage_PC');
  await expect(page.getByTestId('card').first()).toContainText('(20 vars, 48 obs)');
});

test('drag & drop файла', async ({ page }) => {
  await page.goto('./');
  const buf = (await import('node:fs')).readFileSync(XLSX).toString('base64');
  const dt = await page.evaluateHandle(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const d = new DataTransfer();
    d.items.add(new File([bytes], 'housing_demo.xlsx'));
    return d;
  }, buf);
  await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
  await expect(page.getByTestId('variables')).toContainText('Price');
});

test('автодополнение команды и переменной', async ({ page }) => {
  await load(page);
  const cl = page.getByTestId('cmdline');
  await cl.click();
  await page.keyboard.type('re');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('reg');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('линейная регрессия');
  await page.keyboard.press('Tab');
  await page.keyboard.type(' Pri');
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected]')).toContainText('Price');
  await page.keyboard.press('Tab');
  await page.keyboard.type(' Gin');
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected]')).toContainText('Gini');
  await page.keyboard.press('Enter');
  await expect(cl).toHaveText('reg Price Gini');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('card').last()).toContainText('Number of obs   =        48');
  await expect(page.getByTestId('explain').last()).toContainText('Что записать в работу');
});

test('опции после запятой', async ({ page }) => {
  await load(page);
  await page.getByTestId('cmdline').click();
  await page.keyboard.type('sum Price, d');
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('detail');
});

test('Ctrl+D в do-редакторе выполняет весь файл и рисует 4 графика', async ({ page }) => {
  await load(page);
  await page.getByTestId('tab-do').click();
  await page.getByTestId('do-editor').click();
  await page.keyboard.press(`${mod}+d`);
  await expect(page.getByTestId('card').last()).toContainText('Prob > chi2  =', { timeout: 20_000 });
  await expect(page.getByTestId('card').last()).toContainText('. estat hettest');
  await expect(page.getByTestId('graph')).toHaveCount(4);
  await expect(page.getByTestId('results')).toContainText('Heteroskedasticity |      48.00     47    0.4321');
  await page.getByTestId('assumptions-btn').click();
  await expect(page.getByTestId('assumptions')).toContainText('нарушена');
});

test('история ↑ и ошибка в стиле Stata', async ({ page }) => {
  await load(page);
  await page.getByTestId('cmdline').click();
  await page.keyboard.type('reg Price gini');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  const last = page.getByTestId('card').last();
  await expect(last).toContainText('variable gini not found');
  await expect(last).toContainText('r(111);');
  await expect(last).toContainText('Gini');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('cmdline')).toHaveText('reg Price gini');
});

test('переключение темы', async ({ page }) => {
  await page.goto('./');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByTestId('theme-toggle').click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe(after === 'dark' ? 'rgb(18, 22, 28)' : 'rgb(243, 245, 248)');
});
