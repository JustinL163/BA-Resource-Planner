import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { runInContext } from 'node:vm';
import { metadata } from '../../.generated-content/planner';
import { eventEngine } from '../../src/lib/domain/events';
import { eventRequirements, summarizeEventRuns } from '../../src/lib/domain/events/standard';
import { boxEventIds, decodeEventCatalog, decodeEventPlan, decodeStandardEvent, standardEventIds } from '../../src/lib/domain/events/standard-save';
import { boxPullCurrencyNeeded } from '../../src/lib/domain/events/boxes';
import { createEventPlanner } from '../../src/lib/stores/event-planner';
import { isRecord } from '../../src/lib/domain/planner/save';
import { createLegacyContext, evaluate, readJson, readSource } from './legacy-harness';
import type { EventPlan, EventRequirements, EventSummary } from '../../src/lib/domain/events/standard-types';

const config = readJson('planner', 'json', 'events.json');
const students = readJson('planner', 'json', 'skillinfo', 'en.json');
const misc = readJson('planner', 'json', 'event_misc.json');
const resourceMisc = readJson('planner', 'json', 'misc_data.json');
if (!isRecord(config) || !isRecord(config.events)) throw new Error('Invalid event fixture.');
const rawEvents = config.events;

function reference(id: string, plan: EventPlan, includeShop = false, includePoints = false, runs: unknown = { '9': 10 }) {
  const event = decodeStandardEvent(rawEvents[id], id);
  const context = createLegacyContext(['config.js', 'common.js', 'eventPlanner.js'], {
    fixture: { config, students, misc, id, plan: structuredClone(plan), includeShop, includePoints, runs },
    BAEventEngine: eventEngine, Date: { now: () => (event.reset_time + 3 * 86400 + 3600) * 1000 }
  });
  runInContext(readSource('tests', 'fixtures', 'event-core.legacy.js'), context);
  runInContext(`
    event_config = fixture.config; charlist = fixture.students; event_misc = fixture.misc; current_event = fixture.id;
    event_data = fixture.plan; enabledBonusUnits = event_data.enabled_bonus_units; currencyNeededPre = event_data.currency_needed;
    stageGroup1 = event_data.enabled_stage_groups[0]; stageGroup2 = event_data.enabled_stage_groups[1]; stageGroup3 = event_data.enabled_stage_groups[2];
    optimisationType = event_data.optimisation_type; midEvent = Object.values(event_data.currency_owned).some(v => parseInt(v) > 0);
    displayIncluded = { ShopPurchases: fixture.includeShop, PointRewards: fixture.includePoints };
    Save = () => {}; UpdateNotifications = () => {}; GenerateStagesTable = () => {}; ClearRewards = () => {};
    eventLoading = true; CalculateBonuses(); CalculateInitalClear(); CalculateEnergyAvailable(); CalculateNeededFinal();
    UpdateRewardsObtained = (currencies, energy, artifacts, schoolMats, eleph, xps, credit, eligma, secretTech, gearBoxes, gear) => {
      fixture.summary = { currencies, energy, artifacts, schoolMats, eleph, xps, credit, eligma, secretTech, gear };
    };
    InfeasibleModel = () => { fixture.infeasible = true; };
  `, context);
  if (runs === 'solve') {
    runInContext(readSource('planner', 'packages', 'javascript-lp-solver', 'solver.js'), context);
    runInContext(`
      targetedMaterials = optimisationType === 'Materials' ? event_data.optimisation_options : {};
      fixture.runs = solver.Solve(optimisationType === 'Shop' ? GetStagesLinearModel('Energy_Cost','min',false) :
        optimisationType === 'Materials' ? GetStagesMaterialsTargetModel() : GetStagesLinearModel(event_data.optimisation_options,'max',true));
    `, context);
  }
  runInContext("CalculateStageDrops(fixture.runs, optimisationType === 'Manual');", context);
  return { context, requirements: evaluate(context, '({needed:currencyNeeded,pointTarget:event_point_target,midEvent,initial:{cost:initialClearCost,rewards:initialClearRewards}})'),
    summary: evaluate(context, 'fixture.summary ?? null'), runs: evaluate(context, 'stage_runs'), bonuses: evaluate(context, 'currencyBonuses'),
    solution: evaluate(context, 'fixture.runs'),
    energy: runInContext('energyAvailable', context), infeasible: runInContext('fixture.infeasible === true', context) };
}

describe('standard event compatibility and frozen reward outputs', () => {
  for (const id of standardEventIds) {
    const event = decodeStandardEvent(rawEvents[id], id);
    it.each([false, true])(`${id} requirements before/after Owned mode=%s`, (owned) => {
      const plan = decodeEventPlan(undefined, event);
      if (owned) plan.currency_owned = { Event_Point: '1234' };
      const old = reference(id, plan);
      const legacyRequirements = old.requirements as EventRequirements;
      const expected = { ...legacyRequirements, needed: { ...legacyRequirements.needed } };
      for (const rule of event.derivedCurrencyRules ?? []) delete expected.needed[rule.from];
      for (const [currency, amount] of Object.entries(expected.needed)) {
        if (String(amount) === 'NaN') expected.needed[currency] = Number.NaN;
      }
      if (String(expected.pointTarget) === 'NaN') expected.pointTarget = Number.NaN;
      expect(eventRequirements(event, plan)).toEqual(expected);
    });
    for (const owned of [false, true]) for (const includeShop of [false, true]) for (const includePoints of [false, true]) {
      it(`${id} Manual rewards owned=${owned} shop=${includeShop} points=${includePoints}`, () => {
        const plan = decodeEventPlan(undefined, event);
        plan.optimisation_type = 'Manual';
        plan.optimisation_options = { '9': 10, '12': 5 };
        if (owned) plan.currency_owned = { Event_Point: '1234', [Object.keys(event.currencies)[1]]: '200' };
        const old = reference(id, plan, includeShop, includePoints, plan.optimisation_options);
        const requirements = eventRequirements(event, plan);
        const bonuses = eventEngine.calculateEventBonuses(id, event, [], {});
        const summary = summarizeEventRuns(event, plan, requirements, bonuses, old.energy, plan.optimisation_options, includeShop, includePoints, metadata);
        const { runs, feasible, overflowPurchases, ...rewards } = summary;
        void overflowPurchases;
        expect(feasible).toBe(!old.infeasible);
        expect(runs).toEqual(old.runs);
        expect(rewards).toEqual(old.summary);
        expect(old.summary).toMatchSnapshot();
      });
    }
    it(`${id} does not count initial rewards or Owned currency toward the farm-only feasibility check`, () => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Shop';
      const old = reference(id, plan, false, false, { '9': 10 });
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), eventEngine.calculateEventBonuses(id, event, [], {}), old.energy, { '9': 10 }, false, false, metadata);
      expect(summary.feasible).toBe(!old.infeasible);
    });
    it.each(['Shop', 'Currency', 'Materials'] as const)(`${id} solver mode %s matches complete legacy rewards`, (mode) => {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = mode;
      plan.pyro_refreshes = 6; plan.pvp_refreshes = 4; plan.energy_pack = true; plan.energy_carryover = 2000;
      if (id === 'honorable-sea-showdown' && mode === 'Materials') {
        plan.cafe_rank = 10; plan.pyro_refreshes = 20; plan.energy_carryover = 3000;
      }
      plan.enabled_bonus_units = [...new Set(Object.values(event.currencies).flatMap((currency) => currency.bonus_units.map((unit) => unit.id)))];
      if (mode === 'Currency') plan.optimisation_options = event.currency_targets[0];
      if (mode === 'Materials') {
        const material = eventEngine.materialDropOptions(event).find((key) => Object.values(metadata.materialNames).includes(key));
        if (!material) throw new Error('Missing material optimization fixture.');
        plan.optimisation_options = { [material]: true };
      }
      const old = reference(id, plan, true, true, 'solve');
      const contextBonuses: Record<string, number> = runInContext('currencyBonuses', old.context);
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), contextBonuses, old.energy, old.solution, true, true, metadata);
      const { runs, feasible, overflowPurchases, ...rewards } = summary;
      void overflowPurchases;
      if (event.derivedCurrencyRules?.length) {
        // The old result marks this event infeasible because its source-less BOOM input is
        // checked as if it had to be farmed. The replacement checks only the derived stage currency.
        expect(feasible).toBe(true);
        expect(runs).toEqual(old.runs);
        expect(rewards).toEqual(old.summary);
      } else {
        expect(feasible).toBe(!old.infeasible);
      }
      if (feasible && !event.derivedCurrencyRules?.length) {
        expect(runs).toEqual(old.runs);
        expect(rewards).toEqual(old.summary);
      }
    });
  }
  it('matches the original BOX Shadow Looming point-to-Eleph formula at tier boundaries without applying it to the rerun', () => {
    const id = 'box-shadow-looming';
    const event = decodeStandardEvent(rawEvents[id], id);
    for (const [points, expected] of [[0, 127], [299, 127], [300, 129], [599, 129], [600, 131]] as const) {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Manual';
      plan.optimisation_options = {};
      plan.currency_owned = { Event_Point: String(points), EXPO_Souvenirs: '1' };
      const old = reference(id, plan, false, false, {});
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, old.energy, {}, false, false, metadata);
      expect(summary.eleph['26014']).toBe(expected);
      const { runs, feasible, ...rewards } = summary;
      expect(feasible).toBe(!old.infeasible);
      expect(runs).toEqual(old.runs);
      expect(rewards).toEqual(old.summary);
    }

    const rerunId = 'box-shadow-looming-rerun';
    const rerun = decodeStandardEvent(rawEvents[rerunId], rerunId);
    const rerunPlan = decodeEventPlan(undefined, rerun);
    rerunPlan.optimisation_type = 'Manual';
    rerunPlan.optimisation_options = {};
    rerunPlan.currency_owned = { Event_Point: '600', EXPO_Souvenirs: '1' };
    const oldRerun = reference(rerunId, rerunPlan, false, false, {});
    const rerunSummary = summarizeEventRuns(rerun, rerunPlan, eventRequirements(rerun, rerunPlan), {}, oldRerun.energy, {}, false, false, metadata);
    expect(rerunSummary.eleph['26014']).toBeUndefined();
  });

  it.each(['secret-midnight-party', 'secret-midnight-party-rerun'])('%s preserves the 270:1 BOOM shop conversion through initial, edited and Owned requirements', (id) => {
    const event = decodeStandardEvent(rawEvents[id], id);
    const rule = event.derivedCurrencyRules?.[0];
    if (!rule || rule.from !== 'BOOM_Classic_Collection' || rule.to !== 'Youkai_MAX_Umeboshi_Flavor') {
      throw new Error('Missing Secret Midnight Party currency rule.');
    }
    const defaults = decodeEventPlan(undefined, event);
    expect(defaults.currency_needed[rule.from]).toBe(200);
    expect(defaults.currency_needed[rule.to]).toBe(54000);
    expect(eventRequirements(event, defaults).initial.rewards[rule.to]).toBe(10330);
    expect(eventRequirements(event, defaults).needed[rule.to]).toBe(43670);
    expect(eventRequirements(event, {
      ...defaults, currency_needed: { ...defaults.currency_needed, [rule.from]: 40, [rule.to]: 54000 }
    }).needed[rule.to]).toBe(470);

    const edited = decodeEventPlan({
      ...defaults,
      currency_needed: { ...defaults.currency_needed, [rule.from]: 40, [rule.to]: 54000 }
    }, event);
    expect(edited.currency_needed[rule.to]).toBe(10800);
    expect(eventRequirements(event, edited).needed[rule.to]).toBe(470);

    const midwayWithOtherCurrency = { ...edited, currency_owned: { Fluffy_Pillow: '1' } };
    expect(eventRequirements(event, midwayWithOtherCurrency).needed[rule.to]).toBe(10800);
    const midwayWithYoukai = { ...edited, currency_owned: { [rule.to]: '500' } };
    expect(eventRequirements(event, midwayWithYoukai).needed[rule.to]).toBe(10300);
    const midwayWithLegacyBoomOwned = { ...edited, currency_owned: { [rule.from]: '1' } };
    expect(eventRequirements(event, midwayWithLegacyBoomOwned).needed[rule.to]).toBe(10800);

    const zero = decodeEventPlan({ ...edited, currency_needed: { ...edited.currency_needed, [rule.from]: 0 } }, event);
    expect(zero.currency_needed[rule.to]).toBe(0);
    expect(eventRequirements(event, zero).needed[rule.to]).toBe(0);
    expect(() => decodeEventPlan({ shop_purchases: { [rule.from]: {} }, currency_needed: { [rule.to]: 100 } }, event)).toThrow('Missing source currency requirement');
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This currency requires the legacy planner');
  });

  it('preserves the 270:1 Wooden Doll conversion for Fair and Square Aquatic Showdown', () => {
    const id = 'honorable-sea-showdown';
    const event = decodeStandardEvent(rawEvents[id], id);
    const rule = event.derivedCurrencyRules?.[0];
    if (!rule || rule.from !== 'Wooden_Doll_(Renge)' || rule.to !== 'Wooden_Doll_(Yukari)') {
      throw new Error('Missing Fair and Square Aquatic Showdown currency rule.');
    }

    const defaults = decodeEventPlan(undefined, event);
    expect(defaults.currency_needed[rule.from]).toBe(200);
    expect(defaults.currency_needed[rule.to]).toBe(54000);
    const initialTarget = eventRequirements(event, defaults).initial.rewards[rule.to];
    expect(eventRequirements(event, defaults).needed[rule.to]).toBe(Math.max(54000 - initialTarget, 0));

    const edited = decodeEventPlan({
      ...defaults,
      currency_needed: { ...defaults.currency_needed, [rule.from]: 40, [rule.to]: 54000 }
    }, event);
    expect(edited.currency_needed[rule.to]).toBe(10800);
    expect(eventRequirements(event, edited).needed[rule.to]).toBe(Math.max(10800 - initialTarget, 0));

    expect(eventRequirements(event, { ...edited, currency_owned: { [rule.to]: '500' } }).needed[rule.to]).toBe(10300);
    expect(eventRequirements(event, { ...edited, currency_owned: { [rule.from]: '1' } }).needed[rule.to]).toBe(10800);
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This currency requires the legacy planner');
  });

  it('preserves Winter Skies shop conversion, first-clear and Owned Event Points, and count-only point tiers', () => {
    const id = 'winter-skies-renaissance';
    const event = decodeStandardEvent(rawEvents[id], id);
    const rule = event.derivedCurrencyRules?.[0];
    if (!rule || rule.from !== 'Cultural_Book_Sample' || rule.to !== 'Event_Point' || rule.multiplier !== 120) {
      throw new Error('Missing Winter Skies currency rule.');
    }

    const defaults = decodeEventPlan(undefined, event);
    expect(defaults.currency_needed[rule.from]).toBe(170);
    expect(defaults.currency_needed[rule.to]).toBe(20400);
    const initial = eventRequirements(event, defaults);
    expect(initial.initial.rewards).toMatchObject({ Event_Point: 3390, Critique_Notebook: 1543, Bundle_of_Receipts: 1543 });
    expect(initial.needed[rule.to]).toBe(17010);
    expect(initial.pointTarget).toBe(11610);

    const edited = decodeEventPlan({
      ...defaults,
      currency_needed: { ...defaults.currency_needed, [rule.from]: 40, [rule.to]: 999999 }
    }, event);
    expect(edited.currency_needed[rule.to]).toBe(4800);
    const expectedLegacyRequirements = (plan: EventPlan): EventRequirements => {
      const old = reference(id, plan).requirements as EventRequirements;
      const expected = { ...old, needed: { ...old.needed } };
      delete expected.needed[rule.from];
      return expected;
    };
    expect(eventRequirements(event, edited)).toEqual(expectedLegacyRequirements(edited));
    expect(eventRequirements(event, edited).needed[rule.to]).toBe(1410);

    const ownedPlan = { ...edited, currency_owned: { [rule.to]: '1000' } };
    const owned = eventRequirements(event, ownedPlan);
    expect(owned).toEqual(expectedLegacyRequirements(ownedPlan));
    expect(owned.needed[rule.to]).toBe(3800);
    expect(owned.pointTarget).toBe(14000);

    const untyped = event.point_rewards?.filter((tier) => tier.type === undefined);
    expect(untyped?.map((tier) => [tier.points, tier.count])).toEqual([
      [100, 12], [200, 4], [300, 4], [600, 12], [700, 4], [1000, 10], [1600, 4], [1800, 10],
      [3000, 4], [4200, 3], [5000, 3], [6000, 4], [7000, 3], [11000, 4], [13000, 2]
    ]);
    expect(decodeEventCatalog(config, true).find((entry) => entry.id === id)).toMatchObject({
      name: 'Winter Skies Renaissance', archived: true, comingSoon: false
    });
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This currency requires the legacy planner');
  });

  it('saves the Winter Skies derived Event Point requirement after Cultural Book Sample shop edits', async () => {
    const id = 'winter-skies-renaissance';
    const storage = new MemoryStorage();
    const planner = await store(storage, id);
    const event = get(planner).catalog.find((entry) => entry.id === id)?.event;
    if (!event) throw new Error('Missing Winter Skies event.');

    for (const item of event.shops.Cultural_Book_Sample) {
      expect(planner.setPurchase('Cultural_Book_Sample', String(item.id), 0)).toBe(true);
    }
    expect(planner.setPurchase('Cultural_Book_Sample', 'Pyroxene-120', 10)).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!).events_data[id];
    expect(saved.currency_needed.Cultural_Book_Sample).toBe(40);
    expect(saved.currency_needed.Event_Point).toBe(4800);
  });

  it('preserves the Descent rerun Firecracker-to-Voucher shop conversion and gates MinigameDrop to this rule', () => {
    const id = 'descent-of-five-senses-rerun';
    const event = decodeStandardEvent(rawEvents[id], id);
    const rule = event.derivedCurrencyRules?.[0];
    if (!rule || rule.from !== 'Moonlight_Festival_Firecrackers' || rule.to !== 'Moonlight_Festival_Voucher' ||
      rule.multiplier !== 270 || rule.source !== 'MinigameDrop') {
      throw new Error('Missing Descent rerun currency rule.');
    }

    const defaults = decodeEventPlan(undefined, event);
    expect(defaults.currency_needed[rule.from]).toBe(200);
    expect(defaults.currency_needed[rule.to]).toBe(54000);
    const initial = eventRequirements(event, defaults);
    expect(initial.initial.rewards).toMatchObject({
      Moonlight_Festival_Voucher: 10330,
      Moonlight_Festival_Mooncake: 1541,
      Special_Nutritional_Supplement: 1531
    });
    expect(initial.needed).toMatchObject({
      Moonlight_Festival_Voucher: 43670,
      Moonlight_Festival_Mooncake: 11404,
      Special_Nutritional_Supplement: 14119
    });
    expect(initial.needed).not.toHaveProperty(rule.from);

    const edited = decodeEventPlan({
      ...defaults,
      currency_needed: { ...defaults.currency_needed, [rule.from]: 40, [rule.to]: 18000 }
    }, event);
    expect(edited.currency_needed[rule.to]).toBe(10800);
    expect(eventRequirements(event, edited).needed[rule.to]).toBe(470);

    const zero = decodeEventPlan({
      ...edited,
      currency_needed: { ...edited.currency_needed, [rule.from]: 0 }
    }, event);
    expect(zero.currency_needed[rule.to]).toBe(0);
    expect(eventRequirements(event, zero).needed[rule.to]).toBe(0);

    const owned = eventRequirements(event, {
      ...edited,
      currency_owned: {
        [rule.to]: '500',
        Moonlight_Festival_Mooncake: '100',
        Special_Nutritional_Supplement: '200'
      }
    });
    expect(owned.needed).toMatchObject({
      Moonlight_Festival_Voucher: 10300,
      Moonlight_Festival_Mooncake: 12845,
      Special_Nutritional_Supplement: 15450
    });
    expect(owned.needed).not.toHaveProperty(rule.from);
    expect(decodeEventCatalog(config, true).find((entry) => entry.id === id)).toMatchObject({
      name: 'Descent of the Five Senses', archived: true, comingSoon: false
    });
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This currency requires the legacy planner');
    expect(() => decodeStandardEvent(rawEvents[id], 'winter-skies-renaissance')).toThrow('This currency requires the legacy planner');
  });

  it('saves the Descent rerun derived Voucher target after Firecracker shop edits', async () => {
    const id = 'descent-of-five-senses-rerun';
    const storage = new MemoryStorage();
    const planner = await store(storage, id);
    const event = get(planner).catalog.find((entry) => entry.id === id)?.event;
    if (!event) throw new Error('Missing Descent rerun event.');

    for (const item of event.shops.Moonlight_Festival_Firecrackers) {
      expect(planner.setPurchase('Moonlight_Festival_Firecrackers', String(item.id), 0)).toBe(true);
    }
    expect(planner.setPurchase('Moonlight_Festival_Firecrackers', 'Pyroxene-1200', 1)).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!).events_data[id];
    expect(saved.currency_needed.Moonlight_Festival_Firecrackers).toBe(40);
    expect(saved.currency_needed.Moonlight_Festival_Voucher).toBe(10800);
    expect(decodeEventPlan(saved, event).currency_needed.Moonlight_Festival_Voucher).toBe(10800);
  });

  it('preserves Railroad Runaway Sticker milestones, repeat rewards, and the legacy MinigameDrop feasibility edge', () => {
    const id = 'railroad-runaway';
    const event = decodeStandardEvent(rawEvents[id], id);
    expect(event.currencies.Iron_Pipe.source).toBe('MinigameDrop');
    expect(event.derivedCurrencyRules).toBeUndefined();
    expect(decodeEventCatalog(config, true).find((entry) => entry.id === id)).toMatchObject({
      name: 'Highlander Railroad Runaway', archived: true, comingSoon: false
    });
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This currency requires the legacy planner');
    expect(() => decodeStandardEvent(rawEvents[id], 'descent-of-five-senses-rerun')).toThrow('This currency requires the legacy planner');

    const defaults = decodeEventPlan(undefined, event);
    expect(defaults.currency_needed).toMatchObject({
      Highlander_Commemorative_Sticker: 22000,
      Freight_Train_Route_Map: 16095,
      Mysterious_Cargo: 18200,
      Iron_Pipe: 215
    });
    const initial = eventRequirements(event, defaults);
    expect(initial.initial.cost).toBe(295);
    expect(initial.initial.rewards).toMatchObject({
      Highlander_Commemorative_Sticker: 2230,
      Freight_Train_Route_Map: 1531,
      Mysterious_Cargo: 1531
    });
    expect(initial.needed).toMatchObject({
      Highlander_Commemorative_Sticker: 19770,
      Freight_Train_Route_Map: 14564,
      Mysterious_Cargo: 16669,
      Iron_Pipe: Number.NaN
    });

    const thresholds = [2250, 7200, 11850, 16050, 19350, 21900];
    for (const stickers of [2249, 2250, 2251, 7199, 7200, 7201, 11849, 11850, 11851,
      16049, 16050, 16051, 19349, 19350, 19351, 21899, 21900, 21901,
      25199, 25200, 25201]) {
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Manual';
      plan.optimisation_options = {};
      plan.currency_owned = { Highlander_Commemorative_Sticker: String(stickers) };
      const legacy = reference(id, plan, false, false, {});
      const legacySummary = legacy.summary as EventSummary;
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, legacy.energy, {}, false, false, metadata);
      const milestones = thresholds.filter((threshold) => stickers >= threshold).length;
      const repeats = stickers >= 21900 ? Math.floor((stickers - 21900) / 3300) : 0;
      const expectedEleph = milestones * 40 + repeats * 6;
      const expectedPipes = milestones === 0 ? 0 : 15 + (milestones - 1) * 40 + repeats * 10;
      expect(summary.eleph['16017'] ?? 0, `${stickers} Stickers Eleph`).toBe(expectedEleph);
      expect(summary.currencies.Iron_Pipe ?? 0, `${stickers} Stickers Iron Pipes`).toBe(expectedPipes);
      expect(summary.eleph['16017'] ?? 0).toBe(legacySummary.eleph['16017'] ?? 0);
      expect(summary.currencies.Iron_Pipe ?? 0).toBe(legacySummary.currencies.Iron_Pipe ?? 0);
    }

    const editedTarget = decodeEventPlan(undefined, event);
    editedTarget.optimisation_type = 'Shop';
    editedTarget.currency_needed.Iron_Pipe = 216;
    editedTarget.currency_owned = {
      Highlander_Commemorative_Sticker: '22000', Freight_Train_Route_Map: '16095', Mysterious_Cargo: '18200'
    };
    const legacy = reference(id, editedTarget, true, true, {});
    const summary = summarizeEventRuns(event, editedTarget, eventRequirements(event, editedTarget), {}, legacy.energy, {}, true, true, metadata);
    expect(summary.eleph['16017']).toBe(240);
    expect(summary.currencies.Iron_Pipe).toBe(215);
    expect(summary.feasible).toBe(true);
    expect(summary.feasible).toBe(!legacy.infeasible);
  });

  it('preserves the Serenade Promenade rerun overflow cap and remaps 10058 Eleph into existing 16016 rewards', () => {
    const id = 'serenade-promenade-rerun';
    const event = decodeStandardEvent(rawEvents[id], id);
    const overflow = event.shops.Event_Point.find((item) => item.overflow);
    expect(overflow).toMatchObject({ type: 'Eleph', id: 16016, count: 0, cost: 450, overflow_cap: 999 });
    expect(decodeEventCatalog(config, true).find((entry) => entry.id === id)).toMatchObject({
      name: 'Serenade Promenade', archived: true, comingSoon: false
    });
    expect(() => decodeStandardEvent(rawEvents[id])).toThrow('This overflow shop requires the legacy planner');

    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual';
    plan.optimisation_options = {};
    plan.currency_owned = { Event_Point: '300' };
    plan.shop_purchases.Event_Point['10058'] = 1;
    plan.shop_purchases.Event_Point['16016'] = 2;
    plan.currency_needed.Event_Point = event.shops.Event_Point.reduce((total, item) =>
      total + Number(plan.shop_purchases.Event_Point[String(item.id)] ?? 0) * item.cost, 0);

    const old = reference(id, plan, true, true, {});
    const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan),
      eventEngine.calculateEventBonuses(id, event, [], {}), old.energy, {}, true, true, metadata);
    const { runs, feasible, overflowPurchases, ...rewards } = summary;
    void overflowPurchases;
    expect(feasible).toBe(!old.infeasible);
    expect(runs).toEqual(old.runs);
    expect(rewards).toEqual(old.summary);
    expect(summary.eleph['16016']).toBe(17);
    expect(summary.eleph['10058']).toBe(0);
  });

  it.each([0, 449, 450, 450 * 999 - 1, 450 * 999, 450 * 1000])(
    'matches legacy Serenade Currency overflow at %s leftover Event Points', (leftover) => {
      const id = 'serenade-promenade-rerun';
      const event = decodeStandardEvent(rawEvents[id], id);
      const plan = decodeEventPlan(undefined, event);
      plan.optimisation_type = 'Currency';
      plan.optimisation_options = 'Event_Point';
      plan.shop_purchases.Event_Point = Object.fromEntries(event.shops.Event_Point.map((item) => [String(item.id), 0]));
      plan.currency_needed = Object.fromEntries(Object.keys(event.currencies).map((currency) => [currency, 0]));
      plan.currency_owned = { Event_Point: String(leftover), Live_Ticket: '1' };

      const old = reference(id, plan, true, false, {});
      const summary = summarizeEventRuns(event, plan, eventRequirements(event, plan),
        eventEngine.calculateEventBonuses(id, event, [], {}), old.energy, {}, true, false, metadata);
      const expected = runInContext('event_data.shop_purchases.overflow_Event_Point?.[16016] ?? 0', old.context);
      expect(summary.overflowPurchases?.Event_Point?.['16016']).toBe(expected);
      const { runs, feasible, overflowPurchases, ...rewards } = summary;
      void overflowPurchases;
      expect(feasible).toBe(!old.infeasible);
      expect(runs).toEqual(old.runs);
      expect(rewards).toEqual(old.summary);
      expect(summary.overflowPurchases?.Event_Point?.['16016']).toBe(Math.min(Math.floor(leftover / 450), 999));
    }
  );

  it('drops legacy calculated Serenade overflow saves and bounds regular overflow purchases', () => {
    const id = 'serenade-promenade-rerun';
    const event = decodeStandardEvent(rawEvents[id], id);
    const defaults = decodeEventPlan(undefined, event);
    const oldSave = decodeEventPlan({
      ...defaults,
      optimisation_type: 'Currency',
      optimisation_options: 'Event_Point',
      shop_purchases: { ...defaults.shop_purchases, overflow_Event_Point: { '16016': 12 } }
    }, event);
    expect(oldSave.shop_purchases.overflow_Event_Point).toBeUndefined();
    expect(oldSave.shop_purchases.Event_Point['16016']).toBe(0);
    expect(() => decodeEventPlan({
      ...defaults,
      optimisation_type: 'Manual',
      shop_purchases: { ...defaults.shop_purchases, Event_Point: { ...defaults.shop_purchases.Event_Point, '16016': 1000 } }
    }, event)).toThrow('Invalid event purchase count');
  });

  it('accepts legacy numeric-string Manual runs and does not fabricate solver success', () => {
    const event = decodeStandardEvent(rawEvents['lore-pursuit-s2']);
    const plan = decodeEventPlan(undefined, event);
    plan.optimisation_type = 'Manual';
    plan.optimisation_options = { '9': '10' };
    expect(summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, plan.optimisation_options, false, false, metadata).runs).toEqual({ '9': 10 });
    expect(summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, { '9': '3.0' }, false, false, metadata).runs).toEqual({ '9': 3 });
    expect(() => summarizeEventRuns(event, plan, eventRequirements(event, plan), {}, 10000, { feasible: false }, false, false, metadata)).toThrow();
    plan.currency_needed.Unknown = 123;
    expect(() => eventRequirements(event, plan)).toThrow('Unknown required event currency');
  });
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

async function store(storage: MemoryStorage, selected = 'lore-pursuit-s2') {
  const planner = createEventPlanner(metadata, () => storage);
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const value = url.includes('misc_data') ? resourceMisc : url.includes('event_misc') ? misc : url.includes('events.json') ? config : students;
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  try { await planner.initialise(); } finally { fetchMock.mockRestore(); }
  planner.select(selected);
  return planner;
}

describe('event saves, state safety and explicit standard-event gating', () => {
  it('exposes reviewed standard/Omikuji events and retains the coming-soon flag on supported card events', () => {
    const entries = decodeEventCatalog({ ...config, event_order: ['lore-pursuit-s2', 'magical-girl-trinity', '|art-for-whom'] });
    expect(entries.map((entry) => Boolean(entry.event))).toEqual([true, true, true]);
    expect(entries[2].comingSoon).toBe(true);
    expect(() => decodeEventPlan({ enabled_stage_groups: [false, false, false] }, decodeStandardEvent(rawEvents['lore-pursuit-s2']))).toThrow();
  });

  it('exposes the original BOX Shadow Looming event as a reviewed archive while keeping other unreviewed events gated', () => {
    const entries = decodeEventCatalog(config, true);
    const shadowRaw = rawEvents['box-shadow-looming'];
    if (!isRecord(shadowRaw) || !Array.isArray(shadowRaw.point_rewards)) throw new Error('Missing BOX Shadow Looming point rewards.');
    const shadow = entries.find((entry) => entry.id === 'box-shadow-looming');
    expect(shadow).toMatchObject({
      name: 'BOX Shadow Looming Over Millennium', archived: true, comingSoon: false
    });
    expect(shadow?.event?.eventId).toBe('box-shadow-looming');
    expect(shadow?.event?.stage_groups).toEqual(['1-4', '5-8', '9-12']);
    expect(shadow?.event?.point_rewards).toHaveLength(shadowRaw.point_rewards.length);

    const unreviewed = decodeEventCatalog({ ...config, event_order: ["summer-sky's-promise"] });
    expect(unreviewed[0].event).toBeNull();
  });

  it('preserves prototype-shaped unknown zero shop keys as inert saved data', () => {
    const event = decodeStandardEvent(rawEvents['lore-pursuit-s2']);
    const raw: unknown = JSON.parse('{"shop_purchases":{"__proto__":{"unused":0}}}');
    const plan = decodeEventPlan(raw, event);
    expect(Object.hasOwn(plan.shop_purchases, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(plan.shop_purchases)).toBeNull();
    expect(JSON.parse(JSON.stringify(plan)).shop_purchases['__proto__']).toEqual({ unused: 0 });
  });

  it('preserves all unrelated saves/events and selected-event future fields across edits', async () => {
    const storage = new MemoryStorage();
    const source = { exportVersion: 2, characters: [{ unknown: true }], groups: { Team: [['10000']] }, future: { keep: true },
      events_data: { other: { untouched: true }, 'lore-pursuit-s2': { futureSetting: { keep: true } } } };
    storage.setItem('save-data', JSON.stringify(source));
    const planner = await store(storage);
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    expect(planner.setMode('Manual')).toBe(true);
    expect(planner.setManualRuns(9, 12)).toBe(true);
    const result = JSON.parse(storage.getItem('save-data')!);
    expect(result.characters).toEqual(source.characters);
    expect(result.groups).toEqual(source.groups);
    expect(result.future).toEqual(source.future);
    expect(result.events_data.other).toEqual(source.events_data.other);
    expect(result.events_data['lore-pursuit-s2'].futureSetting).toEqual({ keep: true });
    expect(result.events_data['lore-pursuit-s2'].optimisation_options).toEqual({ '9': 12 });
  });

  it.each(['secret-midnight-party', 'secret-midnight-party-rerun'])('%s saves the derived requirement again after BOOM shop edits', async (id) => {
    const storage = new MemoryStorage();
    const planner = await store(storage, id);
    const initial = get(planner).plan;
    const event = get(planner).catalog.find((entry) => entry.id === id)?.event;
    if (!initial || !event) throw new Error('Missing event plan.');
    expect(initial.currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(54000);

    for (const item of event.shops.BOOM_Classic_Collection) {
      expect(planner.setPurchase('BOOM_Classic_Collection', String(item.id), 0)).toBe(true);
    }
    expect(planner.setPurchase('BOOM_Classic_Collection', 'Pyroxene-1200', 1)).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!).events_data[id];
    expect(saved.currency_needed.BOOM_Classic_Collection).toBe(40);
    expect(saved.currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(10800);

    expect(planner.setPurchase('BOOM_Classic_Collection', 'Pyroxene-1200', 0)).toBe(true);
    expect(JSON.parse(storage.getItem('save-data')!).events_data[id].currency_needed.Youkai_MAX_Umeboshi_Flavor).toBe(0);
  });

  it('saves the derived Wooden Doll requirement again after Renge shop edits', async () => {
    const id = 'honorable-sea-showdown';
    const storage = new MemoryStorage();
    const planner = await store(storage, id);
    const initial = get(planner).plan;
    const event = get(planner).catalog.find((entry) => entry.id === id)?.event;
    if (!initial || !event) throw new Error('Missing event plan.');
    expect(initial.currency_needed['Wooden_Doll_(Yukari)']).toBe(54000);

    for (const item of event.shops['Wooden_Doll_(Renge)']) {
      expect(planner.setPurchase('Wooden_Doll_(Renge)', String(item.id), 0)).toBe(true);
    }
    expect(planner.setPurchase('Wooden_Doll_(Renge)', 'Pyroxene-1200', 1)).toBe(true);
    const saved = JSON.parse(storage.getItem('save-data')!).events_data[id];
    expect(saved.currency_needed['Wooden_Doll_(Renge)']).toBe(40);
    expect(saved.currency_needed['Wooden_Doll_(Yukari)']).toBe(10800);
  });

  it.each(boxEventIds)('keeps %s boxed shop targets transactional and rejects edits to reward-only Owned currency', async (id) => {
    const storage = new MemoryStorage();
    const source = {
      exportVersion: 2, futureField: { keep: true }, events_data: { unrelated: { keep: true }, [id]: { futureSetting: { keep: true } } }
    };
    storage.setItem('save-data', JSON.stringify(source));
    const planner = await store(storage);
    expect(planner.select(id)).toBe(true);
    const event = decodeStandardEvent(rawEvents[id]);
    const currency = Object.keys(event.currencies).find((key) => event.currencies[key].source === 'BoxPull');
    const drawCurrency = currency ? event.currencies[currency].pull_currency : undefined;
    if (!currency || !drawCurrency || !event.boxes || event.box_clear_cost === undefined) throw new Error('Missing box data.');
    const reward = event.shops[currency][0];
    expect(planner.setPurchase(currency, String(reward.id), 1)).toBe(true);
    const root = JSON.parse(storage.getItem('save-data')!);
    const eventSave = root.events_data[id];
    const cost = event.shops[currency].reduce((total, item) => total + Number(eventSave.shop_purchases[currency][String(item.id)] ?? 0) * item.cost, 0);
    expect(eventSave.currency_needed[currency]).toBe(cost);
    expect(eventSave.currency_needed[drawCurrency]).toBe(boxPullCurrencyNeeded({ boxes: event.boxes, box_clear_cost: event.box_clear_cost }, cost));
    expect(eventSave.futureSetting).toEqual({ keep: true });
    expect(root.events_data.unrelated).toEqual(source.events_data.unrelated);
    expect(root.futureField).toEqual(source.futureField);
    const snapshot = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setOwnedCurrency(currency, 123)).toBe(false);
      expect(storage.getItem('save-data')).toBe(snapshot);
    } finally { log.mockRestore(); }
  });

  it('reads the newest root save and rejects conflicting selected-event changes', async () => {
    const storage = new MemoryStorage();
    const planner = await store(storage);
    expect(planner.setEnergy('cafe_rank', 6)).toBe(true);
    const raw = JSON.parse(storage.getItem('save-data')!);
    raw.groups = { newer: [] };
    storage.setItem('save-data', JSON.stringify(raw));
    expect(planner.setEnergy('pyro_refreshes', 3)).toBe(true);
    const conflicting = JSON.parse(storage.getItem('save-data')!);
    conflicting.events_data['lore-pursuit-s2'].cafe_rank = 9;
    storage.setItem('save-data', JSON.stringify(conflicting));
    const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setEnergy('cafe_rank', 7)).toBe(false);
      expect(get(planner).error).toContain('changed in another window');
      expect(JSON.parse(storage.getItem('save-data')!).events_data['lore-pursuit-s2'].cafe_rank).toBe(9);
      await planner.reload(true);
      expect(planner.setEnergy('cafe_rank', 7)).toBe(true);
      expect(JSON.parse(storage.getItem('save-data')!).groups).toEqual({ newer: [] });
    } finally { consoleMock.mockRestore(); }
  });

  it('reports invalid input and storage failure without replacing the saved plan', async () => {
    const storage = new MemoryStorage();
    const planner = await store(storage);
    expect(planner.setMode('Shop')).toBe(true);
    const source = storage.getItem('save-data');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(planner.setEnergy('cafe_rank', NaN)).toBe(false);
      expect(storage.getItem('save-data')).toBe(source);
      const write = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
      expect(planner.setEnergy('cafe_rank', 6)).toBe(false);
      expect(get(planner).error).toContain('Quota exceeded');
      expect(storage.getItem('save-data')).toBe(source);
      write.mockRestore();
    } finally { log.mockRestore(); }
  });

  it('never overwrites malformed JSON or invalid event settings with defaults', async () => {
    for (const source of ['{broken', JSON.stringify({ events_data: { 'lore-pursuit-s2': { currency_owned: [] } } })]) {
      const storage = new MemoryStorage();
      storage.setItem('save-data', source);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const planner = await store(storage);
        expect(get(planner).error).not.toBe('');
        expect(planner.setEnergy('cafe_rank', 6)).toBe(false);
        expect(storage.getItem('save-data')).toBe(source);
      } finally { log.mockRestore(); }
    }
  });
});
