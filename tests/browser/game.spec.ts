import { expect, test } from './fixtures';

const testData = {
  halos: {
    '1': { name: 'Airi', released: true, altnames: ['Ari'], alts: [23000], weapons: [23000], chocolate: true, surname: 'Kurimura', age: 15, birthday: 'January 30', height: 160 },
    '2': { name: 'Akane', released: true, altnames: ['Kana'], alts: [13000], weapons: [13000], chocolate: true, surname: 'Murokasa', age: 16, birthday: 'April 1', height: 164 }
  }
};

test('the game route loads compatible records and saves a completed round', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('records', JSON.stringify({
    Halos: { score: 123456, time: '1:23.45', correct: 8, wrong: 2, title: 'Halos F 0s 1 C', string: 6327759902507416 },
    LegacyExtra: { keep: true }
  })));
  await page.route('**/game/guesser/data.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ halos: { '1': testData.halos['1'] } })
  }));

  await page.goto('/game/');
  await expect(page).toHaveTitle("Who's that Halo? · Blue Archive");
  await expect(page.getByRole('heading', { name: "Who's that Halo?" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/game/manifest.json');
  await expect(page.getByRole('heading', { name: 'Best scores' })).toBeVisible();
  await expect(page.getByText('Halos F 0s 1 C')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Resource Planner' })).toBeVisible();

  await page.getByRole('button', { name: 'Start guessing' }).click();
  await page.getByLabel('Your guess').fill('Airi');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText(/Score:/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('records') ?? '{}'));
  expect(stored.LegacyExtra).toEqual({ keep: true });
  expect(stored.Halos.correct).toBe(1);
  expect(typeof stored.Halos.string).toBe('number');
  expect(errors).toEqual([]);
});

test('game settings preserve category-specific options and mode limits', async ({ page }) => {
  await page.route('**/game/guesser/data.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(testData)
  }));
  await page.goto('/game/');

  await page.getByRole('button', { name: 'Birthdays', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Full date' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Multiple choice' }).click();
  await expect(page.getByRole('button', { name: '1.5s' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Maximum guesses' })).toHaveCount(0);
  await page.getByRole('button', { name: '1.5s' }).click();
  await page.getByRole('button', { name: 'Freeform', exact: true }).click();
  await expect(page.getByRole('button', { name: '1.5s' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '3s' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Maximum guesses' })).toBeVisible();

  await page.getByRole('button', { name: 'Heights', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Height lenience' })).toBeVisible();
  await page.getByRole('button', { name: 'Silhouettes', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Conscious state' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Awake' })).toBeVisible();
});

test('failed questions can be retried without changing the first-round record', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  await page.route('**/game/guesser/data.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(testData)
  }));
  await page.goto('/game/');
  await page.getByRole('button', { name: 'Start guessing' }).click();
  await page.getByLabel('Your guess').fill('Akane');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Answer: Airi');
  await page.clock.runFor(2000);
  await expect(page.locator('.question-position')).toHaveText('Question 2 of 2');
  await page.getByLabel('Your guess').fill('Akane');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry failed questions (1)' })).toBeVisible();
  const firstRecord = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('records') ?? '{}').Halos));

  await page.getByRole('button', { name: 'Retry failed questions (1)' }).click();
  await expect(page.locator('.question-position')).toHaveText('Question 1 of 1');
  await page.getByLabel('Your guess').fill('Airi');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText(/Retry rounds do not affect saved records/)).toBeVisible();
  const retriedRecord = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('records') ?? '{}').Halos));
  expect(retriedRecord).toBe(firstRecord);
});
