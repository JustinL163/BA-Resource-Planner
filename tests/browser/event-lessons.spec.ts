import { test, expect } from './fixtures';
import { decodeEventPlan, decodeStandardEvent } from '../../src/lib/domain/events/standard-save';
import { isRecord } from '../../src/lib/domain/planner/save';
import { readJson } from '../unit/legacy-harness';

const oldConfig = readJson('planner', 'json', 'old_events.json');
if (!isRecord(oldConfig) || !isRecord(oldConfig.events)) throw new Error('Invalid archived lesson browser fixture.');
const oldEvents = oldConfig.events;
const id = 'on-your-mark';
const event = decodeStandardEvent(oldEvents[id]);
if (!event.lessons) throw new Error('Missing lesson browser fixture.');
const eventTime = (event.start_time + 3600) * 1000;

function savedPlan() {
  const plan = decodeEventPlan({ futureSetting: { keep: true } }, event);
  plan.optimisation_type = 'Manual';
  plan.optimisation_options = { '12': 500 };
  return {
    exportVersion: 2,
    future: { preserve: true },
    events_data: { unrelated: { keep: true }, [id]: plan }
  };
}

test('archived Lessons tab preserves manual run/reward fields, exact rank controls and session-only summary toggle', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(eventTime);
  await page.addInitScript((save) => localStorage.setItem('save-data', JSON.stringify(save)), savedPlan());
  const errors: string[] = [];
  const missingImages: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() === 404 && response.request().resourceType() === 'image') missingImages.push(response.url());
  });

  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  await page.locator(`[data-event-id="${id}"]`).click();
  await page.locator('[data-event-tab="Lessons"]').click();
  const pointBudget = await page.locator('[data-event-lesson-points]').getAttribute('data-event-lesson-points');
  expect(Number(pointBudget)).toBeGreaterThanOrEqual(16000);
  await expect(page.locator('[data-event-lesson-location]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('.stage-groups')).toHaveCount(0);

  await page.locator('[data-event-lesson-max="0"]').click();
  const beforePostRuns = await page.evaluate((key) => JSON.parse(localStorage.getItem('save-data')!).events_data[key], id);
  expect(beforePostRuns.lesson_pre_runs).toHaveLength(28);
  expect(beforePostRuns.lesson_pre_runs.every((location: number) => location === 0)).toBe(true);
  await expect(page.locator('.rank-level')).toContainText('8');
  await expect(page.locator('[data-event-lesson-post-runs="0"]')).toBeVisible();
  await page.locator('[data-event-lesson-post-runs="0"]').fill('4');
  await page.locator('[data-event-lesson-post-runs="0"]').press('Tab');
  const beforeDisplayToggle = await page.evaluate(() => localStorage.getItem('save-data'));
  const saved = JSON.parse(beforeDisplayToggle!);
  expect(saved.events_data[id].lesson_post_runs['0']).toBe(4);
  expect(saved.events_data[id].futureSetting).toEqual({ keep: true });
  expect(saved.events_data.unrelated).toEqual({ keep: true });
  expect(saved.future).toEqual({ preserve: true });

  const includeLessons = page.getByRole('checkbox', { name: 'Lesson Rewards', exact: true });
  await includeLessons.check();
  await expect(page.locator('[data-event-rewards="eleph"] [data-event-reward="16010"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('save-data'))).toBe(beforeDisplayToggle);
  await page.locator('[data-event-lesson-reset]').click();
  const reset = await page.evaluate((key) => JSON.parse(localStorage.getItem('save-data')!).events_data[key], id);
  expect(reset.lesson_pre_runs).toEqual([]);
  expect(reset.lesson_post_runs).toEqual({});
  expect(await page.locator('[data-event-rewards="eleph"] [data-event-reward="16010"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(missingImages).toEqual([]);
});

test('the generated archive remains scoped to the four reviewed Lessons events', async ({ page }) => {
  await page.goto('/planner/event-planner/');
  await page.getByRole('checkbox', { name: 'Show earlier supported events', exact: true }).check();
  for (const eventId of ['on-your-mark', 'hot-spring-rerun', 'restoration-project', 'on-your-mark-rerun']) {
    await expect(page.locator(`[data-event-id="${eventId}"]`)).toBeVisible();
  }
  await page.locator('[data-event-id="on-your-mark-rerun"]').click();
  await expect(page.locator('[data-event-tab="Lessons"]')).toBeVisible();
});
