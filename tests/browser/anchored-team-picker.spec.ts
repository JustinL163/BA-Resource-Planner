import { test, expect } from './fixtures';
import type { Locator, Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

async function openTeams(page: Page, group: (string | null)[][] = [[null, null, null, null, null, null]]) {
  await page.addInitScript((teams) => localStorage.setItem('save-data', JSON.stringify({
    exportVersion: 2, characters: [], groups: { Test: teams }, language: 'EN',
    owned_materials: {}, disabled_characters: [], character_order: []
  })), group);
  await page.goto('/planner/resources/');
  await page.getByRole('button', { name: 'Teams Editor', exact: true }).click();
  await page.getByRole('combobox', { name: 'Group', exact: true }).selectOption('Test');
}

async function above(picker: Locator, slot: Locator) {
  await expect.poll(async () => {
    const overlay = await picker.boundingBox();
    const anchor = await slot.boundingBox();
    if (!overlay || !anchor) return false;
    return Math.abs(overlay.y + overlay.height + 6 - anchor.y) < 2;
  }).toBe(true);
}

test('team picking is a small modeless overlay above the active slot, not a screen-covering modal', async ({ page }) => {
  await openTeams(page);
  const slot = page.locator('[data-sort-id="0:0"]');
  await slot.click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  await expect(picker).toHaveAttribute('aria-modal', 'false');
  await expect(page.locator('dialog:modal')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await above(picker, slot);
  const bounds = await picker.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(360);
  expect(bounds!.height).toBeLessThan(200);
  await expect(slot).toHaveAttribute('aria-expanded', 'true');
  await expect(picker.getByRole('searchbox')).toBeFocused();
  const addTeam = page.getByRole('button', { name: 'Add team', exact: true });
  await addTeam.click();
  await expect(picker).not.toBeVisible();
  await expect(addTeam).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test.length)).toBe(2);
});

test('the same overlay follows each next slot across Striker and Special roles', async ({ page }) => {
  await openTeams(page);
  await page.locator('[data-sort-id="0:0"]').click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  const search = picker.getByRole('searchbox');
  const names = ['Aru', 'Eimi', 'Haruna', 'Hifumi', 'Hibiki', 'Karin'];
  for (const [index, name] of names.entries()) {
    const slot = page.locator(`[data-sort-id="0:${index}"]`);
    await above(picker, slot);
    await expect(slot).toHaveAttribute('aria-expanded', 'true');
    await expect(search).toBeFocused();
    await search.fill(name);
    await page.keyboard.press('1');
  }
  await expect(picker).not.toBeVisible();
  await expect(page.locator('[data-sort-id="0:5"]')).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test[0]))
    .toEqual(['10000', '10001', '10002', '10003', '20000', '20001']);
});

test('clicking another slot relocates the picker and resets search without blocking the page', async ({ page }) => {
  await openTeams(page);
  await page.locator('[data-sort-id="0:0"]').click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  await picker.getByRole('searchbox').fill('Aru');
  const other = page.locator('[data-sort-id="0:4"]');
  await other.click();
  await above(picker, other);
  await expect(picker.getByRole('searchbox')).toHaveValue('');
  await expect(picker.getByRole('searchbox')).toBeFocused();
  await picker.getByRole('searchbox').fill('Hibiki');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test[0][4])).toBe('20000');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups.Test[0][0])).toBeNull();
});

test('scrolling and resizing keep the overlay attached and within the visible viewport', async ({ page }) => {
  await openTeams(page, Array.from({ length: 4 }, () => [null, null, null, null, null, null]));
  const slot = page.locator('[data-sort-id="0:0"]');
  await slot.click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  await above(picker, slot);
  await page.evaluate(() => window.scrollBy(0, 100));
  await above(picker, slot);
  await page.setViewportSize({ width: 500, height: 500 });
  await expect.poll(async () => {
    const bounds = await picker.boundingBox();
    return bounds !== null && bounds.x >= 0 && bounds.y >= 0 &&
      bounds.x + bounds.width <= 500 && bounds.y + bounds.height <= 500;
  }).toBe(true);
  await above(picker, slot);
});

test('Escape clears search before closing and restores focus; resource add stays modal', async ({ page }) => {
  await openTeams(page);
  const slot = page.locator('[data-sort-id="0:0"]');
  await slot.click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  await picker.getByRole('searchbox').fill('Aru');
  await page.keyboard.press('Escape');
  await expect(picker.getByRole('searchbox')).toHaveValue('');
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(slot).toBeFocused();
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await page.getByRole('button', { name: 'Add characters', exact: true }).click();
  await expect(page.locator('dialog:modal')).toHaveCount(1);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await expect(page.getByRole('button', { name: 'Grid picker', exact: true })).toBeVisible();
});

test('moving keyboard focus back to page controls dismisses without stealing their focus', async ({ page }) => {
  await openTeams(page);
  await page.locator('[data-sort-id="0:0"]').click();
  const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
  await expect(picker.getByRole('searchbox')).toBeFocused();
  const control = page.getByRole('button', { name: 'Add team', exact: true });
  await control.focus();
  await expect(picker).not.toBeVisible();
  await expect(control).toBeFocused();
});

test.describe('touch anchoring', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  test('moves to the next team on mobile while keeping slot and picker visible', async ({ page }) => {
    await openTeams(page, [
      ['10000', '10001', '10002', '10003', '20000', null],
      [null, null, null, null, null, null]
    ]);
    await page.locator('[data-sort-id="0:5"]').tap();
    const picker = page.getByRole('dialog', { name: 'Choose team character', exact: true });
    await above(picker, page.locator('[data-sort-id="0:5"]'));
    expect((await picker.boundingBox())!.width).toBeLessThanOrEqual(280);
    expect((await picker.boundingBox())!.height).toBeLessThan(170);
    await picker.getByRole('searchbox').fill('Karin');
    await picker.getByRole('button', { name: 'Pick Karin', exact: true }).tap();
    await above(picker, page.locator('[data-sort-id="1:0"]'));
    await expect(picker.getByRole('searchbox')).toBeFocused();
    const bounds = await picker.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});
