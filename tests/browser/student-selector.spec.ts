import { test, expect } from './fixtures';
import { readJson, readSource } from '../unit/legacy-harness';
import type { Page } from '@playwright/test';

async function emptyPlan(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify({
      exportVersion: 2, characters: [], groups: { Test: null }, language: 'EN', owned_materials: {},
      disabled_characters: [], character_order: [], site_version: '1.4.23'
    }));
  });
  await page.goto('/planner/resources/');
  await expect(page.getByRole('button', { name: 'Add characters', exact: true })).toBeEnabled();
}

test('main add defaults to five numbered raid-style choices with autofocus and alias matching', async ({ page }) => {
  await emptyPlan(page);
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add characters', exact: true });
  const search = dialog.getByRole('searchbox', { name: 'Search characters', exact: true });
  await expect(search).toBeFocused();
  await expect(dialog.getByRole('group', { name: 'Character search results' }).getByRole('button')).toHaveCount(5);
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toHaveCount(0);
  await search.fill('broko');
  await expect(dialog.getByRole('group').getByRole('button').first()).toHaveAccessibleName('Pick Shiroko (Cycling)');
  await page.keyboard.press('1');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters.map((character: { id: string }) => character.id)))
    .toEqual(['10024']);
  await search.fill('Kirara');
  await expect(dialog.getByRole('group').getByRole('button').first()).toHaveAccessibleName('Pick Kirara');
  await page.keyboard.press('Enter');
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters.map((character: { id: string }) => character.id)))
    .toEqual(['10024', '10093']);
  await search.fill('Aru');
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters.map((character: { id: string }) => character.id)))
    .toContain('10000');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('all five number shortcuts choose their displayed ID and Escape clears before closing', async ({ page }) => {
  await emptyPlan(page);
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const search = dialog.getByRole('searchbox', { name: 'Search characters', exact: true });
  for (const position of [5, 4, 3, 2, 1]) {
    await expect(search).toBeFocused();
    const result = dialog.getByRole('group').getByRole('button').nth(position - 1);
    const name = await result.getAttribute('aria-label');
    await page.keyboard.press(String(position));
    await expect(search).toBeFocused();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters.at(-1).name);
    expect(`Pick ${saved}`).toBe(name);
  }
  await search.fill('some text');
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('switching to the existing grid keeps the search and pending batch selection', async ({ page }) => {
  await emptyPlan(page);
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('Aru');
  await dialog.getByRole('button', { name: 'Grid picker', exact: true }).click();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await expect(dialog.getByRole('searchbox')).toHaveValue('Aru');
  await dialog.getByRole('checkbox', { name: 'Aru Gehenna', exact: true }).check();
  await dialog.getByRole('button', { name: 'Search picker', exact: true }).click();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await dialog.getByRole('button', { name: 'Grid picker', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Aru Gehenna', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Add selected', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters.map((character: { id: string }) => character.id))).toEqual(['10000']);
});

test('team search advances through roles, supports fuzzy aliases, and hides borrowing after use', async ({ page }) => {
  await emptyPlan(page);
  await page.getByRole('button', { name: 'Teams Editor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption('Test');
  await page.locator('[data-sort-id="0:0"]').click();
  const dialog = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  const search = dialog.getByRole('searchbox');
  await expect(search).toBeFocused();
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toBeVisible();
  await search.fill('broko');
  await page.keyboard.press('Shift');
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toBeChecked();
  await page.keyboard.press('1');
  await expect(search).toBeFocused();
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test[0][0])).toEqual({ id: '10024' });
  for (const name of ['Aru', 'Eimi', 'Haruna', 'Hibiki', 'Karin']) {
    await search.fill(name);
    await expect(dialog.getByRole('group').getByRole('button').first()).toHaveAccessibleName(`Pick ${name}`);
    await page.keyboard.press('1');
    if (name !== 'Karin') await expect(search).toBeFocused();
  }
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test[0]))
    .toEqual([{ id: '10024' }, '10000', '10001', '10002', '20000', '20001']);
});

test('an existing borrowed slot can be replaced but borrowing stays hidden until it is cleared', async ({ page }) => {
  await emptyPlan(page);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('save-data')!);
    save.groups.Test = [[{ id: '10000' }, null, null, null, null, null]];
    localStorage.setItem('save-data', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Teams Editor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption('Test');
  await page.locator('[data-sort-id="0:0"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Clear slot', exact: true }).click();
  await page.locator('[data-sort-id="0:0"]').click();
  await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toBeVisible();
});

test('legacy raids and tournaments automatically index canonical names missing from the alias file', async ({ page, context }) => {
  await context.route('https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js', (route) => route.fulfill({
    contentType: 'text/javascript', body: readSource('planner', 'packages', 'jquery', 'jquery.min.js')
  }));
  await context.route('https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js', (route) => route.fulfill({
    contentType: 'text/javascript', body: readSource('planner', 'packages', 'sweetalert2', 'sweetalert2.min.js')
  }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of ['/planner/raids.html', '/planner/tournaments.html']) {
    await page.goto(route);
    await page.waitForFunction('typeof studentSearchIndex !== "undefined" && Boolean(studentSearchIndex)');
    expect(await page.evaluate('SearchStudent("Kirara", 5)[0]')).toBe('10093');
    expect(await page.evaluate('SearchStudent("broko", 5)[0]')).toBe('10024');
  }
  expect(errors).toEqual([]);
});

test('manual alias changes are additive rather than replacing canonical names', async ({ page, context }) => {
  const raw = readJson('planner', 'json', 'student_info.json');
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid alias fixture.');
  await context.route('**/json/student_info.json*', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ ...raw, '10093': { EN: ['manual-kirara-name'] } })
  }));
  await page.goto('/planner/raids.html');
  await page.waitForFunction('typeof studentSearchIndex !== "undefined" && Boolean(studentSearchIndex)');
  expect(await page.evaluate('SearchStudent("manual-kirara-name", 5)[0]')).toBe('10093');
  expect(await page.evaluate('SearchStudent("Kirara", 5)[0]')).toBe('10093');
});

test.describe('touch selector', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('shows a compact five-result row with working touch selection and view switching', async ({ page }) => {
    await emptyPlan(page);
    await page.getByRole('button', { name: 'Add characters', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await dialog.getByRole('searchbox').fill('Kirara');
    await dialog.getByRole('button', { name: 'Pick Kirara', exact: true }).tap();
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Grid picker', exact: true }).tap();
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await expect(dialog.getByRole('checkbox', { name: 'Borrowed', exact: true })).toHaveCount(0);
  });
});
