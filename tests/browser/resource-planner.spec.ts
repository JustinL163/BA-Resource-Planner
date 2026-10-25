import { test, expect } from './fixtures';
import { metadata } from '../../.generated-content/planner';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { readJson, readSource, createLegacyContext } from '../unit/legacy-harness';
import { runInContext } from 'node:vm';

const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'misc_data.json');
const dataset = decodePlannerDataset(students, misc, metadata);

function save() {
  return {
    exportVersion: 2, characters: [createCharacter(dataset.students['10000'], metadata)],
    character_order: ['10000'], disabled_characters: [], owned_materials: {},
    groups: { Existing: [['10000', null]] }, events_data: { existing: { target: 42 } },
    language: 'EN', site_version: '1.4.23', futureField: { retained: true }
  };
}

test('adds and edits characters and persists calculated costs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('button', { name: 'Grid picker', exact: true }).click();
  await picker.getByRole('searchbox', { name: 'Search characters' }).fill('Aru');
  await picker.getByRole('checkbox', { name: 'Aru Gehenna', exact: true }).check();
  await picker.getByRole('button', { name: 'Add selected' }).click();
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Aru' });
  await editor.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('90');
  await editor.getByRole('button', { name: 'Save character' }).click();
  await expect(editor).not.toBeVisible();
  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  await page.getByRole('button', { name: 'Total Needed', exact: true }).click();
  await expect(page.locator('[data-resource="Credit"] [data-value="required"]')).not.toHaveText('0');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Level Target', exact: true })).toHaveValue('90');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters[0].target.level)).toBe(90);
  expect(errors).toEqual([]);
});

test('inventory updates preserve unrelated data and all totals match the legacy formulas', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('90');
  await page.getByRole('button', { name: 'Save character' }).click();
  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  await page.getByRole('button', { name: 'Owned', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search resources' }).fill('Credit');
  const owned = page.getByRole('spinbutton', { name: 'Owned Credit', exact: true });
  await owned.fill('500000');
  await owned.press('Tab');
  await expect(owned).toHaveValue('500000');
  const current = await page.evaluate(() => localStorage.getItem('save-data'));
  const reference = createLegacyContext(['config.js', 'common.js', 'pageLogic.js'], {
    charlist: students, fixture: { misc, save: JSON.parse(current!) }, disabledChars: []
  });
  runInContext(readSource('tests', 'fixtures', 'resource-calculations.legacy.js'), reference);
  runInContext(readSource('tests', 'fixtures', 'resource-aggregates.legacy.js'), reference);
  runInContext(`misc_data = fixture.misc; data = fixture.save; ownedMatDict = {...data.owned_materials};
    for (const character of data.characters) calculateCharResources(character, false);
    updateAggregateCount();`, reference);
  await page.getByRole('button', { name: 'Remaining Needed', exact: true }).click();
  const row = page.locator('[data-resource="Credit"]');
  expect((await row.locator('[data-value="needed"]').innerText()).replaceAll(',', ''))
    .toBe(String(runInContext('neededMatDict.Credit', reference)));
  const persisted = JSON.parse(current!);
  expect(persisted.groups).toEqual(save().groups);
  expect(persisted.events_data).toEqual(save().events_data);
  expect(persisted.futureField).toEqual(save().futureField);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click({ modifiers: ['Control'] });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).disabled_characters)).toEqual(['10000']);
  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  await expect(page.locator('[data-resource="Credit"]')).toHaveCount(0);
});

test('preferences and edits synchronize across tabs without replacing team/event fields', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/planner/resources/');
  await first.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await first.reload();
  await expect(first.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/planner/resources/');
  await expect(second.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
  await first.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await first.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('80');
  await first.getByRole('button', { name: 'Save character' }).click();
  await second.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await expect(second.getByRole('spinbutton', { name: 'Level Target', exact: true })).toHaveValue('80');
  await second.keyboard.press('Escape');
  await first.getByRole('button', { name: 'Light theme', exact: true }).click();
  await expect(second.locator('.site')).toHaveAttribute('data-theme', 'light');
  await second.getByRole('combobox', { name: 'Language' }).selectOption('Kr');
  await expect(second.getByRole('combobox', { name: 'Language' })).toHaveValue('Kr');
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data)).toEqual(save().events_data);
});

test('invalid saves are not overwritten and valid import is an explicit recovery path', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', '{broken'); });
  await page.goto('/planner/resources/');
  await expect(page.getByRole('alert').filter({ hasText: 'JSON' }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe('{broken');
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Save JSON', exact: true }).fill(JSON.stringify(save()));
  await page.getByRole('checkbox', { name: 'I confirm replacing my current saved plan' }).check();
  await page.getByRole('button', { name: 'Import save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('data-backup-modern'))).toBe('{broken');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('button', { name: 'Download save' }).click();
  expect((await download).suggestedFilename()).toBe('blue-archive-planner.json');
});

test('failed writes stay visible and do not close an unsaved editor', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('90');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save character' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Quota exceeded');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters[0].target.level)).toBe('1');
});

test('mobile workflows have usable dialogs and do not overflow the page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeFocused();
  await page.getByText('Filters and sorting', { exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search characters' }).fill('not-a-character');
  await expect(page.getByText('No characters match this view.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
});

test('a failed dataset request is visible and retry does not discard the stored plan', async ({ page, context }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await context.route('**/json/misc_data.json*', (route) => route.fulfill({
    status: 500, contentType: 'application/json', body: '{}'
  }));
  await page.goto('/planner/resources/');
  await expect(page.getByRole('alert')).toContainText('HTTP 500');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).events_data)).toEqual(save().events_data);
  await context.unroute('**/json/misc_data.json*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
});

test('an open editor detects a competing edit instead of overwriting it', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/planner/resources/');
  await first.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await first.reload();
  const second = await context.newPage();
  await second.goto('/planner/resources/');
  await second.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await second.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('90');
  await first.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await first.getByRole('spinbutton', { name: 'Level Target', exact: true }).fill('80');
  await first.getByRole('button', { name: 'Save character' }).click();
  await second.getByRole('button', { name: 'Save character' }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('another window');
  expect(await second.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters[0].target.level)).toBe(80);
});
