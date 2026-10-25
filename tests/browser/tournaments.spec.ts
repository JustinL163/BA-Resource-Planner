import { expect, test } from './fixtures';

function savedMatch() {
  return {
    Tournament: 'tournament-7', Stage: 'qualifiers', Game: 'game-1', Player1: 'Wiggle', Player2: 'airu', Armour: 'light',
    ForcePick: '10000', Player1Bans: ['10001'], Player2Bans: [],
    Player1Teams: [['10000', null, null, null, ['10001'], null]],
    Player2Teams: [[null, null, null, null, null, null]],
    Player1Score: '2', Player2Score: '1'
  };
}

test('modern tournament route loads records and saves the legacy payload with the password header', async ({ page }) => {
  const errors: string[] = [];
  let savedPayload: Record<string, unknown> | undefined;
  let savedHeaders: Record<string, string> | undefined;
  let loadCount = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('TournamentPassword', 'private-test-password'));
  await page.route('https://api.justin163.com/loadtourneydata', (route) => {
    loadCount++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: JSON.stringify([JSON.stringify(savedMatch())]) }) });
  });
  await page.route('https://api.justin163.com/settourneydata', async (route) => {
    savedPayload = route.request().postDataJSON() as Record<string, unknown>;
    savedHeaders = await route.request().allHeaders();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Result: 'Data saved' }) });
  });

  await page.goto('/planner/tournaments/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tournaments' })).toBeVisible();
  await expect(page.locator('.last-update')).toContainText('Last data update:');
  expect(loadCount).toBe(1);
  await page.getByRole('combobox', { name: 'Player 1', exact: true }).selectOption('Wiggle');
  await page.getByRole('combobox', { name: 'Player 2', exact: true }).selectOption('airu');
  await expect(page.getByRole('spinbutton', { name: 'Player 1 score' })).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Force pick: Aru' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Player 1 teams, team 1, special 1: Eimi, borrowed' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Player 1', exact: true }).selectOption('airu');
  await page.getByRole('combobox', { name: 'Player 2', exact: true }).selectOption('Wiggle');
  await expect(page.getByRole('combobox', { name: 'Player 1', exact: true })).toHaveValue('Wiggle');
  await expect(page.getByRole('spinbutton', { name: 'Player 1 score' })).toHaveValue('2');

  await page.getByRole('spinbutton', { name: 'Player 1 score' }).fill('3');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Successfully updated' })).toBeVisible();

  expect(savedPayload).toEqual({ ...savedMatch(), Player1Score: '3' });
  expect(savedHeaders?.tournamentpassword).toBe('private-test-password');
  expect(JSON.stringify(savedPayload)).not.toContain('private-test-password');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Wait 5s before saving again');
  expect(errors).toEqual([]);
});

test('manual tournament loads surface API errors and remember the password', async ({ page }) => {
  let loadCount = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://api.justin163.com/loadtourneydata', async (route) => {
    loadCount++;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ Error: 'Wrong tournament password' }) });
  });
  await page.goto('/planner/tournaments/');
  await page.getByLabel('Tournament Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Get Updates' }).click();
  await expect(page.getByRole('alert')).toContainText('Wrong tournament password');
  expect(loadCount).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('TournamentPassword'))).toBe('wrong-password');
  expect(errors).toEqual([]);
});

test('successful manual tournament refresh has a five-second cooldown', async ({ page }) => {
  let loadCount = 0;
  await page.route('https://api.justin163.com/loadtourneydata', (route) => {
    loadCount++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Data: '[]' }) });
  });
  await page.goto('/planner/tournaments/');
  await page.getByLabel('Tournament Password').fill('test-password');
  await page.getByRole('button', { name: 'Get Updates' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Successfully updated' })).toBeVisible();
  await page.getByRole('button', { name: 'Get Updates' }).click();
  await expect(page.getByRole('alert')).toContainText('Wait 5s before loading again');
  expect(loadCount).toBe(1);
});

