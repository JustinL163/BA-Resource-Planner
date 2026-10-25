import { test, expect } from './fixtures';
import { metadata } from '../../.generated-content/planner';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { readJson } from '../unit/legacy-harness';
import type { Page } from '@playwright/test';

const dataset = decodePlannerDataset(
  readJson('planner', 'json', 'skillinfo', 'en.json'),
  readJson('planner', 'json', 'misc_data.json'), metadata
);
const characters = ['10000', '10001', '10002'].map((id) => createCharacter(dataset.students[id], metadata));
Object.assign(characters[0].target, {
  level: 90, star: 5, ex: 5, basic: 10, passive: 10, sub: 10,
  gear1: 10, gear2: 10, gear3: 10, ue: 4, ue_level: 60, book_hp: 25
});
characters[0].eleph.farm_nodes = 1;
const save = {
  exportVersion: 2, characters, character_order: characters.map((character) => character.id),
  disabled_characters: [], owned_materials: {}, groups: { retained: [] },
  events_data: { event: { target: 42 } }, language: 'EN', site_version: '1.4.23'
};

async function open(page: Page) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('save-data')) localStorage.setItem('save-data', JSON.stringify(data));
  }, save);
  await page.goto('/planner/resources/');
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
}

async function mouseDrag(page: Page, from: string, to: string, after = true) {
  const source = page.locator(`[data-sort-id="${from}"]`);
  const target = page.locator(`[data-sort-id="${to}"]`);
  await source.scrollIntoViewIfNeeded();
  const first = await source.boundingBox();
  const last = await target.boundingBox();
  if (!first || !last) throw new Error('Missing drag target bounds.');
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width * (after ? 0.8 : 0.2), last.y + last.height / 2, { steps: 12 });
  await expect(target).toHaveClass(after ? /after/ : /before/);
  await page.mouse.up();
}

test('restores compact investment overlays without per-card buttons or full labels', async ({ page }) => {
  await open(page);
  const card = page.getByRole('button', { name: 'Edit Aru', exact: true });
  await expect(card.locator('[data-investment="skills"]')).toHaveText('1111MMMM');
  await expect(card.locator('[data-investment="gear"]')).toHaveText('0000XXX0');
  await expect(card.locator('[data-investment="level"]')).toHaveText('190');
  const bounds = await card.boundingBox();
  expect(bounds!.width).toBe(160);
  expect(bounds!.height).toBeLessThan(190);
  const overlay = await card.locator('[data-investment="skills"]').boundingBox();
  expect(overlay!.y + overlay!.height).toBeLessThan(bounds!.y + bounds!.height);
  await expect(page.getByRole('checkbox', { name: 'Include Aru', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move up Aru', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('main table')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Save JSON', exact: true })).toHaveCount(0);
});

test('Ctrl/Cmd-click, right-click and Disable Mode toggle inclusion without opening the editor', async ({ page }) => {
  await open(page);
  const card = page.getByRole('button', { name: 'Edit Aru', exact: true });
  await card.click({ modifiers: ['Control'] });
  await expect(card).toHaveClass(/excluded/);
  await card.click({ modifiers: ['Meta'] });
  await expect(card).not.toHaveClass(/excluded/);
  await card.click({ button: 'right' });
  await expect(card).toHaveClass(/excluded/);
  await page.getByRole('button', { name: 'Disable Mode', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Toggle inclusion of Aru', exact: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).characters[0].enabled)).toBe(true);
  await page.getByRole('button', { name: 'Edit Mode', exact: true }).click();
  await card.click();
  await expect(page.getByRole('dialog', { name: 'Edit Aru', exact: true })).toBeVisible();
});

test('mouse drag persists custom order and does not trigger editing', async ({ page }) => {
  await open(page);
  await mouseDrag(page, '10000', '10002');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order))
    .toEqual(['10001', '10002', '10000']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-sort-id]').first()).toHaveAttribute('data-sort-id', '10001');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(saved.groups).toEqual(save.groups);
  expect(saved.events_data).toEqual(save.events_data);
});

test('filtered dragging preserves hidden character slots', async ({ page }) => {
  await open(page);
  await page.getByText('Filters and sorting', { exact: true }).click();
  await page.getByRole('combobox', { name: 'School', exact: true }).selectOption('Gehenna');
  await expect(page.locator('[data-sort-id]')).toHaveCount(2);
  await mouseDrag(page, '10000', '10002');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order))
    .toEqual(['10002', '10001', '10000']);
});

test('keyboard sorting works in edit and move modes and restores focus', async ({ page }) => {
  await open(page);
  const card = page.getByRole('button', { name: 'Edit Aru', exact: true });
  await card.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order))
    .toEqual(['10001', '10000', '10002']);
  await expect(card).toBeFocused();
  await page.getByRole('button', { name: 'Move Mode', exact: true }).click();
  await page.getByRole('button', { name: 'Move Aru', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order))
    .toEqual(['10001', '10002', '10000']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Escape cancels a pending pointer drag without changing the order', async ({ page }) => {
  await open(page);
  const first = await page.locator('[data-sort-id="10000"]').boundingBox();
  const last = await page.locator('[data-sort-id="10002"]').boundingBox();
  await page.mouse.move(first!.x + 60, first!.y + 60);
  await page.mouse.down();
  await page.mouse.move(last!.x + 100, last!.y + 60, { steps: 8 });
  await expect(page.locator('[data-sort-id="10000"]')).toHaveClass(/dragging/);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order)).toEqual(save.character_order);
  await expect(page.locator('[data-sort-id="10000"]')).not.toHaveClass(/dragging/);
});

test('resource/gear dialogs show only selected quantities and compact tier matrices', async ({ page }) => {
  await open(page);
  const resources = page.getByRole('button', { name: 'Resources', exact: true });
  await resources.click();
  const dialog = page.getByRole('dialog', { name: 'Resources', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Remaining Needed', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-value="required"]')).toHaveCount(0);
  await expect(dialog.locator('[data-resource="Credit"] [data-value="needed"]')).toBeVisible();
  await dialog.getByRole('button', { name: 'Owned', exact: true }).click();
  const matrices = dialog.locator('.matrices table');
  expect(await matrices.count()).toBeGreaterThanOrEqual(3);
  expect(await matrices.first().locator('thead th').count()).toBe(5);
  await expect(dialog.getByRole('spinbutton', { name: 'Owned BD 1 Gehenna', exact: true })).toBeVisible();
  expect(await matrices.first().locator('tbody tr').evaluateAll((rows) =>
    rows.every((row) => row.getBoundingClientRect().height < 85)
  )).toBe(true);
  await dialog.getByRole('button', { name: 'Close Resources', exact: true }).click();
  await expect(resources).toBeFocused();
  await page.getByRole('button', { name: 'Gear', exact: true }).click();
  const gear = page.getByRole('dialog', { name: 'Gear', exact: true });
  await gear.getByRole('button', { name: 'Owned', exact: true }).click();
  await expect(gear.getByRole('spinbutton', { name: 'Owned T10 Hat', exact: true })).toBeVisible();
  await expect(gear.getByRole('spinbutton', { name: 'Owned Credit', exact: true })).toHaveCount(0);
  await expect(gear.locator('.matrices tbody tr')).toHaveCount(9);
  const hat = gear.getByRole('spinbutton', { name: 'Owned T10 Hat', exact: true });
  await hat.fill('35');
  await hat.press('Tab');
  await expect(hat).toHaveValue('35');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).owned_materials.T10_Hat)).toBe(35);
  await page.keyboard.press('Escape');
  await resources.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Owned', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('card sizing preserves the old preference and retains readable overlays', async ({ page }) => {
  await open(page);
  await page.getByRole('slider', { name: 'Card size', exact: true }).focus();
  await page.keyboard.press('Home');
  expect(await page.evaluate(() => localStorage.getItem('character_box_size'))).toBe('1');
  const card = page.locator('[data-sort-id="10000"]');
  expect((await card.boundingBox())!.width).toBe(80);
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Card size', exact: true })).toHaveValue('1');
});

test.describe('touch and small-screen dialogs', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('Move Mode supports real touch sorting and Disable Mode supports taps', async ({ page, context }) => {
    await open(page);
    await page.getByRole('button', { name: 'Move Mode', exact: true }).tap();
    const first = await page.locator('[data-sort-id="10000"]').boundingBox();
    const last = await page.locator('[data-sort-id="10001"]').boundingBox();
    const cdp = await context.newCDPSession(page);
    const x = first!.x + first!.width / 2;
    const y = first!.y + first!.height / 2;
    const endX = last!.x + last!.width * 0.8;
    const endY = last!.y + last!.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + (endX - x) * step / 8, y: y + (endY - y) * step / 8 }]
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).character_order))
      .toEqual(['10001', '10000', '10002']);
    await page.getByRole('button', { name: 'Disable Mode', exact: true }).tap();
    await page.getByRole('button', { name: 'Toggle inclusion of Aru', exact: true }).tap();
    await expect(page.locator('[data-sort-id="10000"]')).toHaveClass(/excluded/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('resources, gear and transfer stay in viewport and do not extend the character page', async ({ page }) => {
    await open(page);
    for (const title of ['Resources', 'Gear', 'Transfer']) {
      await page.getByRole('button', { name: title, exact: true }).tap();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.width).toBeLessThanOrEqual(375);
      expect(bounds!.height).toBeLessThanOrEqual(812 * 0.9);
      await dialog.getByRole('button', { name: `Close ${title}`, exact: true }).tap();
    }
    await expect(page.locator('main table')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Save JSON', exact: true })).toHaveCount(0);
  });
});
