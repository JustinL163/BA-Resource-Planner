import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { metadata } from '../../.generated-content/planner';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { readJson } from '../unit/legacy-harness';
import type { Page } from '@playwright/test';

const dataset = decodePlannerDataset(readJson('planner', 'json', 'skillinfo', 'en.json'), readJson('planner', 'json', 'misc_data.json'), metadata);
function saved() {
  const characters = ['10000', '10001', '10002', '20000'].map((id) => createCharacter(dataset.students[id], metadata));
  for (const character of characters) Object.assign(character.current, { level: 40, gear1: 7 });
  for (const character of characters) Object.assign(character.target, { level: 60, gear1: 7 });
  return {
    exportVersion: 2, characters, character_order: characters.map((item) => item.id), disabled_characters: [],
    owned_materials: { Credit: 100 }, groups: {
      Main: null, Other: [['10001', null, null, null, '20000', null]]
    },
    events_data: { retained: { target: 42 } }, language: 'EN', site_version: '1.4.23', futureField: { keep: true }
  };
}
async function open(page: Page) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, saved());
  await page.goto('/planner/resources/');
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
}
async function teams(page: Page, name = 'Main') {
  await page.getByRole('button', { name: 'Teams Editor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption(name);
}
async function pick(page: Page, at: string, name: string, borrowed = false) {
  await page.locator(`[data-sort-id="${at}"]`).click();
  const dialog = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  if (borrowed) await dialog.getByRole('checkbox', { name: 'Borrowed', exact: true }).check();
  await dialog.getByRole('searchbox', { name: 'Search characters', exact: true }).fill(name);
  await dialog.getByRole('button', { name: `Pick ${name}`, exact: true }).click();
  if (await dialog.count()) await dialog.getByRole('button', { name: 'Close Choose team character', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('group management preserves empty groups, order, unrelated fields and legacy team representation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await teams(page);
  await page.getByRole('button', { name: 'Create group', exact: true }).click();
  await page.getByRole('textbox', { name: 'Group name', exact: true }).fill('Raid Plan');
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Group', exact: true })).toHaveValue('Raid Plan');
  await pick(page, '0:0', 'Aru');
  await pick(page, '0:1', 'Eimi', true);
  await pick(page, '0:4', 'Hibiki');
  await page.getByRole('button', { name: 'Rename group', exact: true }).click();
  await page.getByRole('textbox', { name: 'Group name', exact: true }).fill('Raid Renamed');
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button', { name: 'Move group', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Group position', exact: true }).fill('1');
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(Object.keys(save.groups)).toEqual(['Raid Renamed', 'Main', 'Other']);
  expect(save.groups['Raid Renamed']).toEqual([['10000', { id: '10001' }, null, null, '20000', null]]);
  expect(save.events_data).toEqual(saved().events_data);
  expect(save.futureField).toEqual(saved().futureField);
  await page.getByRole('link', { name: 'Open legacy tools', exact: true }).click();
  await page.waitForFunction('typeof loaded !== "undefined" && loaded');
  await page.locator('#button-teamstoggle').click();
  await page.locator('#select-groups').selectOption('Raid Renamed');
  await expect(page.locator('#teamsContainer .team-wrapper')).toHaveCount(1);
  await expect(page.locator('#char_borrow_10001')).toBeVisible();
  expect(errors).toEqual([]);
});

test('slot picker respects roles, non-borrowed uniqueness, one borrow and unsaved students', async ({ page }) => {
  await open(page);
  await teams(page);
  await pick(page, '0:0', 'Aru');
  await page.locator('[data-sort-id="0:1"]').click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('searchbox', { name: 'Search characters' }).fill('Aru');
  await expect(picker.getByRole('button', { name: 'Pick Aru', exact: true })).toHaveCount(0);
  await picker.getByRole('checkbox', { name: 'Borrowed', exact: true }).check();
  await picker.getByRole('button', { name: 'Pick Aru', exact: true }).click();
  await picker.getByRole('button', { name: 'Close Choose team character', exact: true }).click();
  await page.locator('[data-sort-id="0:2"]').click();
  await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Borrowed', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close Choose team character', exact: true }).click();
  await pick(page, '0:2', 'Hifumi');
  await page.locator('[data-sort-id="0:4"]').click();
  await page.getByRole('dialog').getByRole('searchbox', { name: 'Search characters' }).fill('Aru');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Pick Aru', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Close Choose team character', exact: true }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(data.groups.Main[0][2]).toBe('10003');
  expect(data.characters.map((character: { id: string }) => character.id)).not.toContain('10003');
});

test('team slot dragging, keyboard swapping, team ordering and removal persist', async ({ page }) => {
  await open(page);
  await teams(page, 'Other');
  await page.getByRole('button', { name: 'Add team', exact: true }).click();
  await pick(page, '1:0', 'Aru');
  const source = await page.locator('[data-sort-id="1:0"]').boundingBox();
  const target = await page.locator('[data-sort-id="0:1"]').boundingBox();
  await page.mouse.move(source!.x + 40, source!.y + 40);
  await page.mouse.down();
  await page.mouse.move(target!.x + 40, target!.y + 40, { steps: 10 });
  await expect(page.locator('[data-sort-id="0:1"]')).toHaveClass(/drop/);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Other[0][1])).toBe('10000');
  await page.locator('[data-sort-id="0:1"]').focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Other[0][2])).toBe('10000');
  await page.getByRole('button', { name: 'Move down Team 1', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Other[1][2])).toBe('10000');
  await page.getByRole('button', { name: 'Remove team 1', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal of', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Other.length)).toBe(1);
});

test('group filtering excludes borrows and supports up-to-group inclusion changes', async ({ page }) => {
  await open(page);
  await teams(page);
  await pick(page, '0:0', 'Aru');
  await pick(page, '0:1', 'Haruna', true);
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await page.getByText('Filters and sorting', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption('Main');
  await expect(page.locator('[data-sort-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Exclude all', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).disabled_characters)).toEqual(['10000']);
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption('Other');
  await page.getByRole('checkbox', { name: 'Up to Group', exact: true }).check();
  await expect(page.locator('[data-sort-id]')).toHaveCount(3);
});

test('team text and PNG exports carry names, investment shorthand and valid image data', async ({ page }) => {
  await open(page);
  await teams(page);
  await pick(page, '0:0', 'Aru');
  await pick(page, '0:1', 'Eimi', true);
  await page.getByText('Team text export', { exact: true }).click();
  const text = await page.getByRole('textbox', { name: 'Team text export', exact: true }).inputValue();
  expect(text).toMatch(/Aru +3\u2605 +40 +1111 +7000/);
  expect(text).toMatch(/Eimi +\(Borrowed\)/);
  let downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download text', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('Main.txt');
  downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download team image', exact: true }).click();
  const png = await downloading;
  expect(png.suggestedFilename()).toBe('Main.png');
  const path = await png.path();
  if (!path) throw new Error('Missing downloaded image.');
  const bytes = await readFile(path);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(1050);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(100);
});

test('bulk selection is independent of inclusion and blank fields preserve other investments', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Bulk Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Select Aru', exact: true }).click();
  await page.getByRole('button', { name: 'Select Eimi', exact: true }).click();
  await page.getByRole('button', { name: 'Edit selected', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const gear = metadata.fields.find((field) => field.key === 'gear1')!;
  await dialog.getByRole('spinbutton', { name: 'Bulk Level Target', exact: true }).fill('90');
  await dialog.getByRole('spinbutton', { name: `Bulk ${gear.label} Current`, exact: true }).fill('0');
  await dialog.getByRole('checkbox', { name: 'I confirm applying these changes to the selected characters' }).check();
  await dialog.getByRole('button', { name: 'Apply bulk changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(data.characters[0].target.level).toBe(90);
  expect(data.characters[1].target.level).toBe(90);
  expect(data.characters[0].current.gear1).toBe('0');
  expect(data.characters[0].target.gear1).toBe(7);
  expect(data.characters[0].current.level).toBe(40);
  expect(data.characters[2].target.level).toBe(60);
  expect(data.disabled_characters).toEqual([]);
  expect(data.groups).toEqual(saved().groups);
  expect(data.events_data).toEqual(saved().events_data);
});

test('bulk confirmation detects a competing edit and cannot partially overwrite the plan', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Bulk Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  await page.getByRole('button', { name: 'Edit selected', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Bulk Level Target', exact: true }).fill('90');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('save-data')!);
    data.characters[1].target.level = 80;
    localStorage.setItem('save-data', JSON.stringify(data));
  });
  await page.getByRole('checkbox', { name: 'I confirm applying these changes to the selected characters' }).check();
  await page.getByRole('button', { name: 'Apply bulk changes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('another window');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(data.characters[0].target.level).toBe(60);
  expect(data.characters[1].target.level).toBe(80);
});

test('a malformed group remains intact and can be deleted only with confirmation', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('save-data')!);
    data.groups.Main = { unsupported: true };
    localStorage.setItem('save-data', JSON.stringify(data));
  });
  await page.reload();
  await teams(page);
  await expect(page.getByRole('alert')).toContainText('unsupported format');
  await page.getByRole('button', { name: 'Delete group', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Main)).toEqual({ unsupported: true });
  await page.getByRole('checkbox', { name: 'I confirm deleting this group' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'OK', exact: true }).click();
  expect(await page.evaluate(() => Object.hasOwn(JSON.parse(localStorage.getItem('save-data')!).groups, 'Main'))).toBe(false);
});

test('screenshot-library failures are visible and a retry can export successfully', async ({ page, context }) => {
  await open(page);
  await teams(page, 'Other');
  await context.route('**/packages/html2canvas/html2canvas.js', (route) => route.abort());
  const button = page.getByRole('button', { name: 'Download team image', exact: true });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('Could not load the screenshot library');
  await expect(button).toBeEnabled();
  await context.unroute('**/packages/html2canvas/html2canvas.js');
  const download = page.waitForEvent('download');
  await button.click();
  expect((await download).suggestedFilename()).toBe('Other.png');
});

test('a stale open slot picker does not overwrite newer team changes', async ({ page }) => {
  await open(page);
  await teams(page);
  await page.locator('[data-sort-id="0:0"]').click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('searchbox', { name: 'Search characters', exact: true }).fill('Aru');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('save-data')!);
    data.groups.Main = [['10001', null, null, null, null, null]];
    localStorage.setItem('save-data', JSON.stringify(data));
  });
  await picker.getByRole('button', { name: 'Pick Aru', exact: true }).click();
  await expect(picker.getByRole('alert')).toContainText('another window');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Main[0][0])).toBe('10001');
});

test.describe('touch teams and bulk editing', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('team slots, swap mode and bulk dialogs fit the compact mobile layout', async ({ page }) => {
    await open(page);
    await teams(page, 'Other');
    await page.getByRole('button', { name: 'Move slots', exact: true }).tap();
    await page.locator('[data-sort-id="0:0"]').tap();
    await page.locator('[data-sort-id="0:1"]').tap();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Other[0][1])).toBe('10001');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Characters', exact: true }).tap();
    await page.getByRole('button', { name: 'Bulk Mode', exact: true }).tap();
    await page.getByRole('button', { name: 'Select Aru', exact: true }).tap();
    await page.getByRole('button', { name: 'Edit selected', exact: true }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
