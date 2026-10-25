import { test, expect } from './fixtures';
import { metadata } from '../../.generated-content/planner';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import type { InvestmentKey } from '../../src/lib/domain/planner/types';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson } from '../unit/legacy-harness';

const dataset = decodePlannerDataset(readJson('planner', 'json', 'skillinfo', 'en.json'),
  readJson('planner', 'json', 'misc_data.json'), metadata);

function save() {
  const character = createCharacter(dataset.students['10000'], metadata);
  character.target.ex = 1;
  character.target.basic = 1;
  character.target.passive = 1;
  character.target.sub = 1;
  return {
    exportVersion: 2, characters: [character], character_order: ['10000'], disabled_characters: [],
    owned_materials: {}, groups: {}, events_data: { keep: true }, language: 'EN', futureField: { keep: true }
  };
}

function inputName(key: InvestmentKey, side = 'Target') {
  const field = metadata.fields.find((field) => field.key === key);
  if (!field) throw new Error(`Missing field ${key}.`);
  return `${field.label} ${side}`;
}

test('skill previews update live without writing the plan or changing cancel/save behaviour', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Aru' });
  await expect(editor.locator('[data-skill-key]')).toHaveCount(4);
  await expect(editor.locator('[data-skill-description]')).toHaveCount(0);
  await editor.locator('[data-skill-key="ex"]').click();
  const description = editor.locator('[data-skill-description="ex"]');
  await expect(description).toContainText('Hard-Boiled Shot');
  await expect(description.locator('[data-skill-cost]')).toHaveText('Cost: 4');
  await expect(description.locator('.skill-description-text [data-skill-value="current"]').first()).toHaveText('274%');
  await editor.getByRole('spinbutton', { name: inputName('ex'), exact: true }).fill('5');
  await expect(description.locator('.skill-description-text [data-skill-value="target"]').first()).toHaveText('521%');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  await page.getByRole('spinbutton', { name: inputName('ex'), exact: true }).fill('5');
  await page.getByRole('button', { name: 'Save character', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(saved.characters[0].target.ex).toBe(5);
  expect(saved.events_data).toEqual(save().events_data);
  expect(saved.futureField).toEqual(save().futureField);
  expect(errors).toEqual([]);
});

test('target bond gear and UE select the same upgraded descriptions as the legacy tooltips', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.locator('[data-skill-key="basic"]').click();
  await expect(editor.locator('[data-skill-description]')).toHaveAttribute('data-skill-variant', 'Public');
  await editor.getByRole('spinbutton', { name: inputName('bond_gear'), exact: true }).fill('2');
  await expect(editor.locator('[data-skill-description]')).toHaveAttribute('data-skill-variant', 'GearPublic');
  await expect(editor.locator('[data-skill-description]')).toContainText('100% chance');
  await editor.getByRole('spinbutton', { name: inputName('star'), exact: true }).fill('5');
  await editor.getByRole('spinbutton', { name: inputName('ue'), exact: true }).fill('2');
  await editor.getByRole('spinbutton', { name: inputName('passive'), exact: true }).fill('10');
  await editor.locator('[data-skill-key="passive"]').click();
  const description = editor.locator('[data-skill-description="passive"]');
  await expect(description).toHaveAttribute('data-skill-variant', 'WeaponPassive');
  await expect(description.locator('[data-skill-value="current"]').first()).toHaveText('2000');
  await expect(description.locator('[data-skill-value="target"]').first()).toHaveText('3800');
});

test('hover/focus previews, pinning, toggle-off and Close keep the editor usable', async ({ page }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog');
  const ex = editor.locator('[data-skill-key="ex"]');
  await ex.hover();
  await expect(editor.locator('[data-skill-description="ex"]')).toBeVisible();
  await editor.getByRole('spinbutton', { name: inputName('level', 'Current'), exact: true }).hover();
  await expect(editor.locator('[data-skill-description]')).toHaveCount(0);
  await ex.focus();
  await expect(editor.locator('[data-skill-description="ex"]')).toBeVisible();
  await ex.press('Enter');
  await editor.getByRole('spinbutton', { name: inputName('level', 'Current'), exact: true }).focus();
  await expect(editor.locator('[data-skill-description="ex"]')).toBeVisible();
  await ex.focus();
  await ex.press('Enter');
  await expect(editor.locator('[data-skill-description]')).toHaveCount(0);
  await ex.press('Enter');
  await editor.locator('[data-skill-description]').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor.locator('[data-skill-description]')).toHaveCount(0);
  await expect(ex).toBeFocused();
  await expect(editor).toBeVisible();
});

test('failed description loading is explicit and retry leaves the saved plan intact', async ({ page, context }) => {
  await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await context.route('**/skillinfo/localisation_en.json', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.goto('/planner/resources/');
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByRole('alert')).toContainText('HTTP 500');
  await context.unroute('**/skillinfo/localisation_en.json');
  await editor.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(editor.locator('[data-skill-key]')).toHaveCount(4);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
});

test('a pinned description follows cross-tab language changes, including missing-translation notices', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/planner/resources/');
  await page.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
  await page.reload();
  const second = await context.newPage();
  await second.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Edit Aru', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.locator('[data-skill-key="ex"]').click();
  await second.getByRole('combobox', { name: 'Language' }).selectOption('Jp');
  const jp = readJson('planner', 'json', 'skillinfo', 'jp.json');
  if (!isRecord(jp) || !isRecord(jp['10000']) || !isRecord(jp['10000'].Skills) || !isRecord(jp['10000'].Skills.Ex)) throw new Error('Invalid JP fixture.');
  await expect(editor.locator('[data-skill-description] h3')).toHaveText(String(jp['10000'].Skills.Ex.Name));
  await expect(editor.locator('[data-skill-description]')).toHaveAttribute('data-skill-variant', 'Ex');
  await expect(editor.locator('[data-skill-key="ex"]')).toHaveAttribute('aria-pressed', 'true');
  await second.getByRole('combobox', { name: 'Language' }).selectOption('En');
  await expect(editor.locator('[data-skill-description] h3')).toHaveText('Hard-Boiled Shot');
  const missing = save();
  missing.characters = [createCharacter(dataset.students['10122'], metadata)];
  missing.character_order = ['10122'];
  missing.language = 'JP';
  await page.keyboard.press('Escape');
  await page.evaluate((data) => localStorage.setItem('save-data', JSON.stringify(data)), missing);
  await page.reload();
  await page.locator('[data-sort-id="10122"]').click();
  await page.locator('[data-skill-key="ex"]').click();
  await expect(page.locator('[data-skill-description]')).toContainText('English description shown');
});

test('mobile skill controls remain compact, toggle on tap, and never execute description markup', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.route('**/skillinfo/en.json', (route) => {
      const students = readJson('planner', 'json', 'skillinfo', 'en.json');
      if (!isRecord(students) || !isRecord(students['10000']) || !isRecord(students['10000'].Skills) || !isRecord(students['10000'].Skills.Ex)) throw new Error('Invalid fixture.');
      students['10000'].Skills.Ex.Desc = '<img src=x onerror="window.skillInjected=true"><script>window.skillInjected=true</script><?1>';
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(students) });
    });
    await page.addInitScript((data) => localStorage.setItem('save-data', JSON.stringify(data)), save());
    await page.goto('/planner/resources/');
    await page.getByRole('button', { name: 'Edit Aru', exact: true }).tap();
    const editor = page.getByRole('dialog');
    const ex = editor.locator('[data-skill-key="ex"]');
    await ex.tap();
    await expect(editor.locator('[data-skill-description]')).toBeVisible();
    await expect(editor.locator('.skill-description-text')).toContainText('<script>');
    expect(await page.evaluate(() => Reflect.get(window, 'skillInjected'))).toBeUndefined();
    expect(await editor.locator('.skill-description-text img, .skill-description-text script').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await editor.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await ex.tap();
    await expect(editor.locator('[data-skill-description]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
