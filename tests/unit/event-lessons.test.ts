import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createContext, runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { applyLessonRewards, decodeLessonDefinition, lessonProgress } from '../../src/lib/domain/events/lessons';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { decodeEventCatalog, decodeEventPlan, decodeStandardEvent, lessonEventIds } from '../../src/lib/domain/events/standard-save';
import type { EventSummary, LessonDefinition } from '../../src/lib/domain/events/standard-types';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';

const currentConfig = readJson('planner', 'json', 'events.json');
const oldConfig = readJson('planner', 'json', 'old_events.json');
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');
if (!isRecord(currentConfig) || !isRecord(currentConfig.events) ||
  !isRecord(oldConfig) || !isRecord(oldConfig.events)) throw new Error('Invalid lesson fixtures.');
const oldEvents = oldConfig.events;
const archivedEvents = Object.fromEntries(lessonEventIds.map((id) => {
  const event = oldEvents[id];
  if (!isRecord(event)) throw new Error(`Missing lesson fixture ${id}.`);
  return [id, event];
}));
const lessonArchive = { events: archivedEvents };

function source(id: string) {
  const raw = archivedEvents[id];
  if (!isRecord(raw) || !isRecord(raw.lessons_template) || !Array.isArray(raw.lessons)) throw new Error(`Invalid lesson event ${id}.`);
  return raw;
}

function lessonDefinition(id: string): LessonDefinition {
  const raw = source(id);
  return decodeLessonDefinition(raw.lessons, raw.lessons_template);
}

function emptySummary(): EventSummary {
  return {
    runs: {}, currencies: {}, artifacts: {}, schoolMats: {}, eleph: {}, xps: {}, gear: {},
    credit: 0, eligma: 0, secretTech: 0, energy: 0, feasible: true
  };
}

function legacyProgress(id: string, preRuns: number[], postRuns: Record<string, number | string>) {
  const raw = source(id);
  const context = createContext({ lessonPreRuns: preRuns, lessonPostRuns: postRuns });
  runInContext(readSource('tests', 'fixtures', 'lessons.legacy.js'), context);
  context.lessonsTemplate = raw.lessons_template;
  return {
    rank: runInContext('LegacyLessonRanks(lessonsTemplate)[0]', context),
    level: runInContext('LegacyLessonRanks(lessonsTemplate)[1]', context),
    rankMaxed: runInContext('LegacyLessonRanks(lessonsTemplate)[2]', context),
    pointsUsed: runInContext('LegacyUsedLessonPoints(lessonsTemplate)', context)
  };
}

function legacyRewards(id: string, preRuns: number[], postRuns: Record<string, number | string>) {
  const raw = source(id);
  const materialNames = new Map(Object.entries(metadata.materialNames));
  const context = createLegacyContext([], {
    event_config: { events: { [id]: raw } },
    current_event: id,
    lessonPreRuns: preRuns,
    lessonPostRuns: postRuns,
    matLookup: { get(id: string) { return materialNames.get(String(id)); } }
  });
  runInContext(readSource('tests', 'fixtures', 'lessons.legacy.js'), context);
  const value: unknown = evaluate(context, `(() => {
    const artifacts = {}, schoolMats = {}, eleph = {}, xps = {};
    const [credit, eligma] = AddLessonRewards(artifacts, schoolMats, eleph, xps, 0, 0, 0);
    return { artifacts, schoolMats, eleph, xps, credit, eligma };
  })()`);
  if (!isRecord(value)) throw new Error('Invalid legacy lesson reward result.');
  const amounts = (source: unknown, label: string): Record<string, number> => {
    if (!isRecord(source)) throw new Error(`Invalid legacy ${label} results.`);
    const result: Record<string, number> = {};
    for (const [key, amount] of Object.entries(source)) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error(`Invalid legacy ${label} reward "${key}".`);
      result[key] = amount;
    }
    return result;
  };
  if (typeof value.credit !== 'number' || typeof value.eligma !== 'number' ||
      !Number.isFinite(value.credit) || !Number.isFinite(value.eligma)) {
    throw new Error('Invalid legacy lesson scalar rewards.');
  }
  return {
    artifacts: amounts(value.artifacts, 'artifact'),
    schoolMats: amounts(value.schoolMats, 'school material'),
    eleph: amounts(value.eleph, 'eleph'),
    xps: amounts(value.xps, 'XP'),
    credit: value.credit,
    eligma: value.eligma
  };
}

describe('reviewed lesson event definitions and exact progression', () => {
  it('decodes only the four explicitly reviewed archived lesson events', () => {
    const entries = decodeEventCatalog(currentConfig, true, lessonArchive);
    expect(entries.filter((entry) => entry.event?.lessons).map((entry) => entry.id)).toEqual(lessonEventIds);
    for (const id of lessonEventIds) {
      const raw = source(id);
      const entry = entries.find((candidate) => candidate.id === id);
      expect(entry?.archived).toBe(true);
      expect(entry?.event?.lessons).toEqual(decodeLessonDefinition(raw.lessons, raw.lessons_template));
      expect(entry?.event?.omikuji).toBeUndefined();
      expect(entry?.event?.boxes).toBeUndefined();
    }
    expect(decodeEventCatalog(currentConfig, true).some((entry) => entry.event?.lessons)).toBe(false);
    expect(() => decodeEventCatalog(currentConfig, true, {})).toThrow('lesson event catalog');
  });

  for (const id of lessonEventIds) {
    const definition = lessonDefinition(id);
    it.each([0, 1, 2, 3, 4, 5, 7, 8, 14, 15, 27, 28])(`${id} preserves legacy rank and level after %i pre-runs`, (count) => {
      const preRuns = Array.from({ length: count }, (_, index) => index % definition.locations.length);
      const postRuns = { 0: '2', 2: 3 };
      const progress = lessonProgress(definition, preRuns, postRuns, 20000);
      const old = legacyProgress(id, preRuns, postRuns);
      expect(progress).toMatchObject(old);
      expect(progress.pointsUsed).toBe((preRuns.length + 5) * definition.lesson_cost);
      expect(progress.pointsRemaining).toBe(20000 - progress.pointsUsed);
      expect(progress.remainingRuns).toBe(Math.max(Math.floor(progress.pointsRemaining / definition.lesson_cost), 0));
    });

    it(`${id} exactly preserves pre-rank and post-rank rewards, expected drops and material substitutions`, () => {
      const preRuns = Array.from({ length: 27 }, (_, index) => (index * 3 + 1) % definition.locations.length);
      const postRuns = { 0: '4', 1: '0', 2: '2', 3: 1 };
      const old = legacyRewards(id, preRuns, postRuns);
      const base = emptySummary();
      base.artifacts = { Existing_Artifact: 7 };
      base.schoolMats = { Existing_School_Mat: 9 };
      base.eleph = { '10001': 3 };
      base.credit = 11;
      base.eligma = 13;
      base.boxes = { clears: 2, leftoverPercent: '75' };
      base.overflowPurchases = { Event_Point: { Ticket: 4 } };
      const modern = applyLessonRewards(base, definition, preRuns, postRuns, metadata);
      expect(modern.artifacts).toEqual({ Existing_Artifact: 7, ...old.artifacts });
      expect(modern.schoolMats).toEqual({ Existing_School_Mat: 9, ...old.schoolMats });
      expect(modern.eleph).toEqual({ '10001': 3, ...old.eleph });
      expect(modern.credit - base.credit).toBe(old.credit);
      expect(modern.eligma - base.eligma).toBeCloseTo(old.eligma, 12);
      expect(base).toEqual({
        ...emptySummary(), artifacts: { Existing_Artifact: 7 }, schoolMats: { Existing_School_Mat: 9 },
        eleph: { '10001': 3 }, credit: 11, eligma: 13, boxes: { clears: 2, leftoverPercent: '75' },
        overflowPurchases: { Event_Point: { Ticket: 4 } }
      });
      if (!modern.boxes || !modern.overflowPurchases) throw new Error('Lesson summary did not preserve optional fields.');
      modern.boxes.clears = 0;
      modern.overflowPurchases.Event_Point.Ticket = 0;
      expect(base.boxes?.clears).toBe(2);
      expect(base.overflowPurchases?.Event_Point.Ticket).toBe(4);
    });
  }

  it('keeps the strict legacy Add/Max threshold and maximum pre-rank count', () => {
    const definition = lessonDefinition('on-your-mark');
    const cost = definition.lesson_cost;
    const ranks = definition.rank_upgrades;
    expect(lessonProgress(definition, [], {}, cost).pointsRemaining).toBe(cost);
    expect(lessonProgress(definition, [], {}, cost).remainingRuns).toBe(1);
    expect(lessonProgress(definition, Array(28).fill(0), {}, 15000).rankMaxed).toBe(true);
    expect(() => decodeEventPlan({ lesson_pre_runs: Array(29).fill(0) }, decodeStandardEvent(source('on-your-mark')))).toThrow();
    for (const invalid of [
      { ...definition, lesson_cost: 0 },
      { ...definition, rank_upgrades: [...ranks].reverse() },
      { ...definition, rewards: [] },
      { ...definition, locations: [] }
    ]) expect(() => decodeLessonDefinition(invalid.locations, invalid)).toThrow();
  });
});

describe('lesson reward validation, feasibility and save compatibility', () => {
  it('rejects unknown reward substitutions, invalid run data, and unknown archive mechanics', () => {
    const definition = lessonDefinition('on-your-mark');
    const badRuns = [-1, 1.5, definition.locations.length];
    for (const index of badRuns) expect(() => lessonProgress(definition, [index], {}, 10000)).toThrow();
    expect(() => lessonProgress(definition, [], JSON.parse('{"__proto__":"1"}'), 10000)).toThrow();
    expect(() => applyLessonRewards(emptySummary(), definition, [99], {}, metadata)).toThrow();
    expect(() => decodeStandardEvent({ ...source('on-your-mark'), boxes: [] })).toThrow();
    expect(() => decodeEventPlan({ lesson_pre_runs: [99] }, decodeStandardEvent(source('on-your-mark')))).toThrow();
    expect(() => decodeEventPlan({ lesson_post_runs: { 4: '1' } }, decodeStandardEvent(source('on-your-mark')))).toThrow();
  });

  it('marks a stage plan infeasible when saved lesson spending exceeds farmed Event Points', () => {
    const event = decodeStandardEvent(source('on-your-mark'));
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual';
    plan.optimisation_options = { '12': 1 };
    plan.lesson_pre_runs = Array(28).fill(0);
    const requirements = eventRequirements(event, plan);
    const summary = summarizeEventRuns(event, plan, requirements, {}, 50000, { '12': 1 }, false, false, metadata);
    expect(summary.currencies.Event_Point).toBeGreaterThan(0);
    expect(summary.feasible).toBe(false);
  });

  class MemoryStorage implements Storage {
    private entries = new Map<string, string>();
    get length() { return this.entries.size; }
    clear() { this.entries.clear(); }
    key(index: number) { return [...this.entries.keys()][index] ?? null; }
    removeItem(key: string) { this.entries.delete(key); }
    getItem(key: string) { return this.entries.get(key) ?? null; }
    setItem(key: string, value: string) { this.entries.set(key, value); }
  }

  async function createPlanner(id: string) {
    const storage = new MemoryStorage();
    storage.setItem('save-data', JSON.stringify({ exportVersion: 2, futureField: { keep: true }, events_data: { [id]: { future: { preserve: true } } } }));
    const planner = createEventPlanner(metadata, () => storage, lessonArchive);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const value = url.includes('misc_data') ? readJson('planner', 'json', 'misc_data.json')
        : url.includes('event_misc') ? misc
          : url.includes('events.json') ? currentConfig : students;
      return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      await planner.initialise();
    } finally {
      fetchMock.mockRestore();
    }
    expect(planner.select(id)).toBe(true);
    return { planner, storage };
  }

  it.each(lessonEventIds)('%s saves legacy lesson fields transactionally and preserves unknown event data', async (id) => {
    const { planner, storage } = await createPlanner(id);
    const definition = lessonDefinition(id);
    expect(planner.setLessonPreRuns([0, 1, 2])).toBe(true);
    expect(planner.setLessonPostRuns({ 0: '4', 2: 1 })).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!);
    expect(saved.events_data[id].lesson_pre_runs).toEqual([0, 1, 2]);
    expect(saved.events_data[id].lesson_post_runs).toEqual({ 0: '4', 2: 1 });
    expect(saved.events_data[id].future).toEqual({ preserve: true });
    expect(saved.futureField).toEqual({ keep: true });
    expect(decodeEventPlan(saved.events_data[id], decodeStandardEvent(source(id))).lesson_pre_runs).toEqual([0, 1, 2]);
    expect(lessonProgress(definition, get(planner).plan?.lesson_pre_runs ?? [], get(planner).plan?.lesson_post_runs ?? {}, 20000).pointsUsed)
      .toBe((3 + 5) * definition.lesson_cost);
    expect(planner.resetLessons()).toBe(true);
    const reset = JSON.parse(storage.getItem('save-data')!).events_data[id];
    expect(reset.lesson_pre_runs).toEqual([]);
    expect(reset.lesson_post_runs).toEqual({});
  });
});
