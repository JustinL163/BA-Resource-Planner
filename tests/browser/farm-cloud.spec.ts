import { createContext, runInContext } from 'node:vm';
import { test, expect } from './fixtures';
import type { BrowserContext, Page, Route } from '@playwright/test';
import { metadata } from '../../.generated-content/planner';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { readJson, readSource } from '../unit/legacy-harness';
import { aggregateResources } from '../../src/lib/domain/planner/aggregates';
import { farmedGeneralConversions, optimiseGearFarm, type FarmServer, type GearSolver } from '../../src/lib/domain/planner/gear-farm';
import type { Resources } from '../../src/lib/domain/resources/types';

const misc = readJson('planner', 'json', 'misc_data.json');
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const dataset = decodePlannerDataset(students, misc, metadata);
const credentials = { username: 'fixture-user', authkey: 'ABC123' };
function saved() {
  const character = createCharacter(dataset.students['10000'], metadata);
  Object.assign(character.target, { gear1: 10, gear2: 10, gear3: 10 });
  return {
    exportVersion: 2, characters: [character], character_order: ['10000'], disabled_characters: [],
    owned_materials: {}, groups: { Retained: [] }, events_data: { event: { target: 42 } },
    language: 'EN', site_version: '1.4.23', futureField: { keep: true }
  };
}
function expectedGear(owned: Resources = {}, server: FarmServer = 'Global', multiplier = 1) {
  const source = saved();
  const totals = aggregateResources(dataset, source.characters, source.disabled_characters, owned, metadata.maxLevel);
  const needed = Object.fromEntries<number>(metadata.equipment.flatMap((key) => (totals.needed[key] ?? 0) > 0 ? [[key, totals.needed[key]]] : []));
  const context = createContext({ self: {} });
  runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
  const solver: GearSolver = { Solve(model) { context.model = model; return runInContext('self.solver.Solve(model)', context); } };
  return optimiseGearFarm({ data: dataset.context.data, needed, owned, server, multiplier, caps: metadata.worldCaps }, solver);
}
async function open(page: Page, account = false) {
  await page.addInitScript(({ source, credentials, account }) => {
    localStorage.setItem('save-data', JSON.stringify(source));
    if (account) {
      localStorage.setItem('username', credentials.username);
      localStorage.setItem('authkey', credentials.authkey);
    }
  }, { source: saved(), credentials, account });
  await page.goto('/planner/resources/');
  await expect(page.getByRole('button', { name: 'Edit Aru', exact: true })).toBeVisible();
}

async function legacyCodec(action: 'compress' | 'decompress', data: string | Uint8Array): Promise<unknown> {
  const context = createContext({ setTimeout, setImmediate, data });
  runInContext(readSource('planner', 'js', 'lzma_worker.js'), context);
  return new Promise((resolve, reject) => {
    context.finish = (result: unknown, error: unknown) => error ? reject(error) : resolve(result);
    runInContext(action === 'compress' ? 'LZMA.compress(data, 9, finish)' : 'LZMA.decompress(data, finish)', context);
  });
}
async function compressed(source: string): Promise<Uint8Array> {
  const bytes = await legacyCodec('compress', source);
  if (!Array.isArray(bytes) || !bytes.every((value: unknown) => typeof value === 'number')) throw new Error('Invalid reference bytes.');
  return new Uint8Array(bytes);
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Username,Auth-Key'
};
async function api(context: BrowserContext, handler: (route: Route) => Promise<void>) {
  await context.route('https://api.justin163.com/**', async (route) => {
    if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers: cors });
    else await handler(route);
  });
}

test('gear recommendations use a real worker with the shared blueprint allocation', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        document.documentElement.dataset.farmWorkers = String(Number(document.documentElement.dataset.farmWorkers ?? 0) + 1);
      }
      terminate() {
        document.documentElement.dataset.farmTerminated = String(Number(document.documentElement.dataset.farmTerminated ?? 0) + 1);
        super.terminate();
      }
    };
  });
  await page.getByRole('button', { name: /^Gear\b/ }).click();
  await expect(page.getByRole('heading', { name: /^Farming recommendations\b/ })).toBeVisible();
  await expect(page.locator('[data-farm-energy]')).toBeVisible();
  const expected = expectedGear();
  const actual = await page.locator('[data-farm-stage]').evaluateAll((rows) => rows.map((row) => ({
    stage: row.getAttribute('data-farm-stage'), runs: Number.parseInt(row.querySelector('[data-farm-runs]')!.textContent!.replaceAll(',', ''))
  })));
  expect(actual).toEqual(expected.runs);
  await expect(page.locator('[data-farm-energy]')).toContainText(expected.energy.toLocaleString('en-US'));
  const conversions = farmedGeneralConversions(expected, dataset.context.data);
  expect(conversions.length).toBeGreaterThan(0);
  await expect(page.getByRole('region', { name: 'Farmed General Blueprint use', exact: true })).toBeVisible();
  const generalTypes = [...new Set(conversions.map((conversion) => conversion.general))];
  await expect(page.locator('[data-farm-conversion-type]')).toHaveCount(generalTypes.length);
  for (const general of generalTypes) {
    const group = page.locator(`[data-farm-conversion-type="${general.slice(2)}"]`);
    const amount = conversions.filter((conversion) => conversion.general === general)
      .reduce((sum, conversion) => sum + conversion.farmed + conversion.owned, 0);
    await expect(group.locator('[data-farm-general-used]')).toHaveText(amount.toLocaleString('en-US'));
    await expect(group.locator('img').first()).toHaveAttribute('src', `/planner/icons/Gear/${general}.png`);
  }
  await expect(page.locator('[data-farm-conversion]')).toHaveCount(conversions.length);
  for (const conversion of conversions) {
    const row = page.locator(`[data-farm-conversion="${conversion.gear}"]`);
    await expect(row.locator('[data-farm-converted-blueprints]')).toHaveText(conversion.blueprints.toLocaleString('en-US'));
    await expect(row.locator('img')).toHaveAttribute('src', metadata.images[conversion.gear]);
  }
  const originalViewport = page.viewportSize()!;
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    const usage = await page.getByRole('region', { name: 'Farmed General Blueprint use', exact: true }).boundingBox();
    const inventory = await page.locator('.inventory-sections.gear-layout').boundingBox();
    expect(usage).not.toBeNull();
    expect(inventory).not.toBeNull();
    expect(Math.abs(usage!.x - inventory!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(usage!.width - inventory!.width)).toBeLessThanOrEqual(1);
    expect(usage!.y).toBeGreaterThanOrEqual(inventory!.y + inventory!.height);
  }
  await page.setViewportSize(originalViewport);
  expect(await page.locator('html').getAttribute('data-farm-workers')).toBe('1');
  expect(await page.locator('html').getAttribute('data-farm-terminated')).toBe('1');
  expect(await page.evaluate(() => 'solver' in window)).toBe(false);
  await page.getByRole('combobox', { name: 'Server', exact: true }).selectOption('CN');
  await expect(page.getByText('Not available to farm on this server', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).server)).toBe('CN');
  await page.getByRole('combobox', { name: 'Normal mission campaign', exact: true }).selectOption('3');
  await expect.poll(() => page.locator('html').getAttribute('data-farm-workers')).toBe('3');
  await expect(page.locator('[data-farm-energy]')).toBeVisible();
  await page.getByRole('button', { name: 'Close Gear', exact: true }).click();
  await page.getByRole('button', { name: /^Gear\b/ }).click();
  await expect(page.getByRole('combobox', { name: 'Normal mission campaign', exact: true })).toHaveValue('3');
  await expect(page.locator('[data-farm-energy]')).toBeVisible();
});

test('gear worker failures are visible and retry does not fall back to blocking calculations', async ({ page, context }) => {
  await context.route('**/js/shared/gear-farm-worker.js', (route) => route.abort());
  await open(page);
  await page.getByRole('button', { name: /^Gear\b/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Worker');
  expect(await page.evaluate(() => 'solver' in window)).toBe(false);
  await context.unroute('**/js/shared/gear-farm-worker.js');
  await page.getByRole('dialog').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('[data-farm-energy]')).toBeVisible();
});

test('gear stock edits recalculate the same allocation displayed by the table in both orientations', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Gear\b/ }).click();
  await expect(page.locator('.matrices.gear')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('group', { name: 'Display', exact: true }).getByRole('button', { name: /^Owned\b/ }).click();
  await page.locator('input[data-resource-key="G_Hat"]').fill('200');
  await page.locator('input[data-resource-key="Choice_T2"]').fill('100');
  await page.locator('input[data-resource-key="Choice_T2"]').blur();
  await page.getByRole('group', { name: 'Display', exact: true }).getByRole('button', { name: /^Remaining needed\b/i }).click();
  await expect(page.locator('.matrices.gear')).toHaveAttribute('aria-busy', 'false');
  const expected = expectedGear({ G_Hat: 200, Choice_T2: 100 });
  await expect(page.locator('[data-farm-energy]')).toContainText(expected.energy.toLocaleString('en-US'));
  for (let orientation = 0; orientation < 2; orientation++) {
    const actual = await page.locator('.matrices.gear table').first().evaluate((table) => {
      const remaining: Record<string, number> = {};
      const general: Record<string, number> = {};
      const choice: Record<string, number> = {};
      table.querySelectorAll<HTMLElement>('[data-resource]').forEach((cell) => {
        const key = cell.dataset.resource!;
        remaining[key] = Number(cell.querySelector('.amount')!.textContent!.replaceAll(',', ''));
        const parent = cell.closest('td')!;
        for (const [kind, result] of [['general', general], ['choice', choice]] as const) {
          const indicator = parent.querySelector(`.gear-use-indicator.${kind}`);
          if (indicator) result[key] = Number(indicator.textContent!.replaceAll(',', '').trim());
        }
      });
      return { remaining, general, choice };
    });
    for (const [key, amount] of Object.entries(expected.allocation.remainingByGear)) expect(actual.remaining[key]).toBe(amount);
    expect(actual.general).toEqual(expected.allocation.generalUsedByGear);
    expect(actual.choice).toEqual(expected.allocation.choiceUsedByGear);
    if (orientation === 0) await page.getByRole('button', { name: 'Transpose gear table', exact: true }).click();
  }
  await page.getByRole('group', { name: 'Display', exact: true }).getByRole('button', { name: /^Leftover\b/ }).click();
  await expect(page.locator('.matrices.gear [data-resource="G_Hat"] .amount')).toHaveText(String(expected.allocation.specialLeftover.G_Hat));
});

test('registration uses the existing API and uploads byte-identical level-nine compression', async ({ page, context }) => {
  let uploaded: Buffer | null = null;
  let registered = false;
  await api(context, async (route) => {
    if (route.request().url().endsWith('/register')) {
      expect(route.request().postDataJSON()).toEqual({ Username: credentials.username });
      registered = true;
      await route.fulfill({ headers: cors, contentType: 'application/json', body: '{"Auth_Key":"ABC123"}' });
    } else {
      expect(route.request().headers().username).toBe(credentials.username);
      expect(route.request().headers()['auth-key']).toBe(credentials.authkey);
      expect(route.request().headers()['content-type']).toBe('application/octet-stream');
      uploaded = route.request().postDataBuffer();
      await route.fulfill({ headers: cors, contentType: 'application/json', body: '{"Result":"Data saved"}' });
    }
  });
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cloud username', exact: true }).fill(credentials.username);
  await page.getByRole('button', { name: 'Register account', exact: true }).click();
  await expect(page.getByText('Account created and current plan saved to cloud.', { exact: true })).toBeVisible();
  expect(registered).toBe(true);
  expect(uploaded).not.toBeNull();
  const expected = await compressed(before!);
  expect(uploaded).toEqual(Buffer.from(expected));
  expect(await page.evaluate(() => localStorage.getItem('username'))).toBe(credentials.username);
  expect(await page.evaluate(() => localStorage.getItem('authkey'))).toBe(credentials.authkey);
  await expect(page.getByRole('button', { name: 'Save to cloud', exact: true })).toBeDisabled();
});

test('loading cloud data requires confirmation, retains an exact backup and remembers credentials', async ({ page, context }) => {
  const remote = { ...saved(), characters: [createCharacter(dataset.students['10001'], metadata)], page_theme: 'light', server: 'JP' };
  const binary = await compressed(JSON.stringify(remote));
  await api(context, (route) => route.fulfill({ headers: cors, contentType: 'application/octet-stream', body: Buffer.from(binary) }));
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cloud username', exact: true }).fill(credentials.username);
  await page.getByLabel('Cloud Auth Key', { exact: true }).fill(credentials.authkey);
  const load = page.getByRole('button', { name: 'Load cloud save', exact: true });
  await expect(load).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I confirm replacing my local plan with the cloud save.', exact: false }).check();
  await load.click();
  await expect(page.getByText('Cloud plan loaded and account details remembered.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('data-backup-modern'))).toBe(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!).groups)).toEqual(remote.groups);
  expect(await page.evaluate(() => localStorage.getItem('username'))).toBe(credentials.username);
  await page.getByRole('button', { name: 'Close Transfer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Eimi', exact: true })).toBeVisible();
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'light');
});

test('a cloud load cannot overwrite edits made while downloading', async ({ page, context }) => {
  const binary = await compressed(JSON.stringify({ ...saved(), characters: [] }));
  await api(context, async (route) => {
    await page.evaluate(() => {
      const source = JSON.parse(localStorage.getItem('save-data')!);
      source.editedDuringDownload = true;
      localStorage.setItem('save-data', JSON.stringify(source));
    });
    await route.fulfill({ headers: cors, contentType: 'application/octet-stream', body: Buffer.from(binary) });
  });
  await open(page, true);
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I confirm replacing my local plan with the cloud save.', exact: false }).check();
  await page.getByRole('button', { name: 'Load cloud save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('local plan changed');
  const source = await page.evaluate(() => JSON.parse(localStorage.getItem('save-data')!));
  expect(source.editedDuringDownload).toBe(true);
  expect(source.characters[0].id).toBe('10000');
});

test('API failures are surfaced without replacing local data', async ({ page, context }) => {
  await api(context, (route) => route.fulfill({
    status: 403, headers: cors, contentType: 'application/json', body: '{"Error":"Fixture account rejected"}'
  }));
  await open(page, true);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('button', { name: 'Save to cloud', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Fixture account rejected');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
});

test('a compressed but invalid cloud plan is rejected before any local replacement', async ({ page, context }) => {
  const binary = await compressed('null');
  await api(context, (route) => route.fulfill({ headers: cors, contentType: 'application/octet-stream', body: Buffer.from(binary) }));
  await open(page, true);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I confirm replacing my local plan with the cloud save.', exact: false }).check();
  await page.getByRole('button', { name: 'Load cloud save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('not an object');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('data-backup-modern'))).toBeNull();
});

test('cloud cooldowns survive reopening the modal and expire after the original interval', async ({ page, context }) => {
  await api(context, (route) => route.fulfill({ headers: cors, contentType: 'application/json', body: '{"Result":"Data saved"}' }));
  await page.clock.install({ time: new Date('2026-10-01T12:00:00Z') });
  await open(page, true);
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save to cloud', exact: true });
  await save.click();
  await expect(page.getByText('Current plan saved to cloud.', { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'Close Transfer', exact: true }).click();
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await expect(save).toBeDisabled();
  await page.clock.fastForward(131000);
  await expect(save).toBeEnabled();
});

test('an initial upload failure retains the registered key without reporting a completed save', async ({ page, context }) => {
  await api(context, (route) => route.fulfill({
    headers: cors, contentType: 'application/json',
    status: route.request().url().endsWith('/register') ? 200 : 503,
    body: route.request().url().endsWith('/register') ? '{"Auth_Key":"ABC123"}' : '{"Error":"Fixture upload unavailable"}'
  }));
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cloud username', exact: true }).fill(credentials.username);
  await page.getByRole('button', { name: 'Register account', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Fixture upload unavailable');
  await expect(page.getByText('Account created. Record the Auth Key;', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('authkey'))).toBe(credentials.authkey);
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  await expect(page.getByRole('button', { name: 'Register account', exact: true })).toBeDisabled();
});

test('credential-storage failure rolls back the whole cloud import', async ({ page, context }) => {
  const binary = await compressed(JSON.stringify({ ...saved(), characters: [] }));
  await api(context, (route) => route.fulfill({ headers: cors, contentType: 'application/octet-stream', body: Buffer.from(binary) }));
  await open(page);
  const before = await page.evaluate(() => localStorage.getItem('save-data'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'authkey') throw new DOMException('Fixture quota exceeded', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cloud username', exact: true }).fill(credentials.username);
  await page.getByLabel('Cloud Auth Key', { exact: true }).fill(credentials.authkey);
  await page.getByRole('checkbox', { name: 'I confirm replacing my local plan with the cloud save.', exact: false }).check();
  await page.getByRole('button', { name: 'Load cloud save', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Fixture quota exceeded');
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('username'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('data-backup-modern'))).toBeNull();
});

test('registration keeps the modal open until its generated key has been received', async ({ page, context }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await api(context, async (route) => {
    if (route.request().url().endsWith('/register')) await gate;
    await route.fulfill({
      headers: cors, contentType: 'application/json',
      body: route.request().url().endsWith('/register') ? '{"Auth_Key":"ABC123"}' : '{"Result":"Data saved"}'
    });
  });
  await open(page);
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Cloud username', exact: true }).fill(credentials.username);
  await page.getByRole('button', { name: 'Register account', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Close Transfer', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Transfer', exact: true })).toBeVisible();
  } finally { release(); }
  await expect(page.getByText('Account created and current plan saved to cloud.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close Transfer', exact: true })).toBeEnabled();
});
