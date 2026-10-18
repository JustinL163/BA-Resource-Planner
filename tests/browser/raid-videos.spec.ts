import { expect, test } from './fixtures';

const storageBootstrap = (local = false) => ({
  username: 'planner-user',
  authkey: 'abcdef',
  defaultServer: 'Global',
  local
});

function remoteVideos() {
  return {
    Hardcore: [
      {
        uuid: 'remote-kirara', score: 32000000, level: 87, link: 'https://youtu.be/remote-kirara', author: 'planner-user',
        teams: [['10093', '10024', null, null, null, null]]
      },
      {
        uuid: 'remote-other', score: 31000000, level: 86, link: 'https://youtu.be/remote-other', author: 'another-user',
        teams: [['10024', null, null, null, null, null]]
      }
    ],
    'Very Hard': [],
    Hard: [],
    Normal: []
  };
}

async function mockRaidFeed(page: import('@playwright/test').Page) {
  await page.route('https://raw.githubusercontent.com/JustinL163/ba-planner-data/main/shared-videos/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(remoteVideos()) })
  );
}

test('modern raid browser preserves timeline filters, default server, and local-video expiry reconciliation', async ({ page }) => {
  const expiry = Date.now() + 60 * 60 * 1000;
  await page.addInitScript((setup) => {
    localStorage.setItem('username', setup.username);
    localStorage.setItem('authkey', setup.authkey);
    localStorage.setItem('default-raids-server', setup.defaultServer);
    localStorage.setItem('local-submissions', JSON.stringify({
      retainedUnknownField: { preserved: true },
      Global: { raids: { '0': { Hardcore: [
        { uuid: 'cached-kirara', score: 33000000, level: 87, link: 'https://youtu.be/cached', teams: [['10093', null, null, null, null, null]], expiry: setup.expiry, local_submission: true },
        { uuid: 'remote-kirara', score: 39000000, level: 87, link: 'https://youtu.be/duplicate', teams: [['10093', null, null, null, null, null]], expiry: setup.expiry, local_submission: true },
        { uuid: 'expired', score: 40000000, level: 87, link: 'https://youtu.be/expired', teams: [['10093', null, null, null, null, null]], expiry: Date.now() - 1, local_submission: true }
      ] } } }
    }));
  }, { username: 'planner-user', authkey: 'abcdef', defaultServer: 'Global', expiry });
  await mockRaidFeed(page);
  await page.goto('/planner/raids/');
  await expect(page.getByRole('heading', { level: 1, name: 'Raid Videos' })).toBeVisible();
  await expect(page.locator('.server-row')).toHaveCount(3);

  await page.getByRole('combobox', { name: 'Filter by boss' }).selectOption('Chesed');
  await page.getByRole('combobox', { name: 'Filter by terrain' }).selectOption('Indoor');
  await expect(page.getByRole('button', { name: /Global Chesed, Indoor/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Global Binah/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('button', { name: 'JP Japan' }).click();
  expect(await page.evaluate(() => localStorage.getItem('default-raids-server'))).toBe('Japan');
  await page.getByRole('button', { name: 'Global Binah, Outdoor, season 0, HC' }).click();
  await expect(page.locator('.raid-video-card')).toHaveCount(3);
  const cached = JSON.parse(await page.evaluate(() => localStorage.getItem('local-submissions')!));
  expect(cached.retainedUnknownField).toEqual({ preserved: true });
  expect(cached.Global.raids['0'].Hardcore.map((entry: { uuid: string }) => entry.uuid)).toEqual(['cached-kirara']);

  await page.getByRole('button', { name: 'Included Students 1' }).click();
  await page.getByRole('searchbox').fill('Kirara');
  await page.getByRole('button', { name: 'Pick Kirara' }).click();
  await expect(page.locator('.raid-video-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Included Students 1: Kirara/ })).toBeVisible();
});

test('authenticated raid submission uses the existing API contract and caches the accepted video', async ({ page }) => {
  await page.addInitScript((setup) => {
    localStorage.setItem('username', setup.username);
    localStorage.setItem('authkey', setup.authkey);
    localStorage.setItem('local-submissions', JSON.stringify({ otherData: 'keep' }));
  }, storageBootstrap());
  await mockRaidFeed(page);
  let apiRequest: { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> } | undefined;
  await page.route('https://api.justin163.com/submitraid', async (route) => {
    const request = route.request();
    apiRequest = {
      url: request.url(), method: request.method(), headers: await request.allHeaders(),
      body: request.postDataJSON() as Record<string, unknown>
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ UUID: 'new-raid-video' }) });
  });
  await page.goto('/planner/raids/');
  await page.getByRole('button', { name: 'Global Binah, Outdoor, season 0, HC' }).click();
  await page.getByRole('button', { name: 'Submit Video' }).click();
  const editor = page.getByRole('dialog', { name: 'New Video Submission' });
  await expect(editor).toBeVisible();
  await editor.locator('input[type="url"]').fill('https://youtu.be/new-video');
  await editor.locator('input[type="number"]').nth(0).fill('30000000');
  await editor.locator('input[type="number"]').nth(1).fill('87');
  await editor.getByRole('button', { name: 'Striker slot 1: empty' }).click();
  await page.getByRole('searchbox').fill('Kirara');
  await page.getByRole('button', { name: 'Pick Kirara' }).click();
  await expect(editor.getByRole('button', { name: 'Striker slot 1: Kirara' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save video' }).click();
  await expect(page.getByText(/Successfully submitted: new-raid-video/)).toBeVisible();

  expect(apiRequest?.url).toBe('https://api.justin163.com/submitraid');
  expect(apiRequest?.method).toBe('POST');
  expect(apiRequest?.headers.username).toBe('planner-user');
  expect(apiRequest?.headers['auth-key']).toBe('abcdef');
  expect(apiRequest?.body).toEqual({
    Server: 'Global', Type: 'raids', Raid_Index: 0, Difficulty: 'Hardcore',
    Score: '30000000', Level: '87', Video_Link: 'https://youtu.be/new-video',
    Teams: [['10093', null, null, null, null, null]]
  });
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('local-submissions')!));
  expect(saved.otherData).toBe('keep');
  expect(saved.Global.raids['0'].Hardcore.at(-1)).toMatchObject({
    uuid: 'new-raid-video', local_submission: true, score: '30000000', link: 'https://youtu.be/new-video'
  });
  expect(saved.Global.raids['0'].Hardcore.at(-1).expiry).toBeGreaterThan(Date.now());
});

test('owned remote videos keep the authenticated edit action and append the edited local copy', async ({ page }) => {
  await page.addInitScript((setup) => {
    localStorage.setItem('username', setup.username);
    localStorage.setItem('authkey', setup.authkey);
  }, storageBootstrap());
  await mockRaidFeed(page);
  let editBody: Record<string, unknown> | undefined;
  await page.route('https://api.justin163.com/editraid', async (route) => {
    editBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ UUID: 'remote-kirara' }) });
  });
  await page.goto('/planner/raids/');
  await page.getByRole('button', { name: 'Global Binah, Outdoor, season 0, HC' }).click();
  await page.getByRole('button', { name: 'Open video submission, score 32,000,000' }).click();
  await page.getByRole('button', { name: 'Edit Video Submission' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Video Submission' });
  await editor.locator('input[type="number"]').nth(0).fill('32000001');
  await editor.getByRole('button', { name: 'Save video' }).click();
  await expect(page.getByText(/Successfully edited: remote-kirara/)).toBeVisible();
  expect(editBody).toMatchObject({
    Server: 'Global', Type: 'raids', Raid_Index: 0, Difficulty: 'Hardcore',
    Score: '32000001', UUID: 'remote-kirara'
  });
});

test('the retired raid URL redirects to the Svelte page', async ({ page }) => {
  await page.goto('/planner/raids.html');
  await expect(page).toHaveURL(/\/planner\/raids\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Raid Videos' })).toBeVisible();
  await expect(page.locator('.server-row')).toHaveCount(3);
});
