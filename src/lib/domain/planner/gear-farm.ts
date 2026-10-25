import type { Resources } from '../resources/types';

export const farmServers = ['Global', 'JP', 'CN'] as const;
export type FarmServer = (typeof farmServers)[number];
export interface GearFarmData {
  gear_rates: Record<string, { Tier: string | number; Rates: number[]; OldRates?: number[] }[]>;
  gear_drops: Record<string, string[]>;
  gear_bp_value: Record<string, number>;
  universal_bp_cost?: Record<string, number>;
}
export type WorldCaps = Record<FarmServer, number | null>;
export interface GearModel {
  optimize: 'AP' | 'allocation';
  opType: 'min';
  variables: Record<string, Resources>;
  constraints: Record<string, { min?: number; max?: number }>;
}
export interface GearFarmResult {
  runs: { stage: string; runs: number }[];
  energy: number;
  unavailable: string[];
}
export interface GearBlueprintAllocation {
  remainingByGear: Resources;
  choiceUsedByGear: Resources;
  generalUsedByGear: Resources;
  specialLeftover: Resources;
}
export interface GearFarmPlan extends GearFarmResult {
  allocation: GearBlueprintAllocation;
  generalConversions: Resources;
}
export interface FarmedGeneralConversion {
  gear: string;
  general: string;
  blueprints: number;
  farmed: number;
  owned: number;
}
export interface GearFarmRequest {
  data: GearFarmData;
  needed: Resources;
  owned: Resources;
  server: FarmServer;
  multiplier: number;
  caps: WorldCaps;
}
interface GearProblem {
  model: GearModel;
  unavailable: string[];
  needed: Resources;
  owned: Resources;
  requirements: Resources;
  recipes: Resources;
  stages: Record<string, Resources>;
}
export interface GearSolver {
  Solve(model: GearModel): unknown;
}

export function farmServer(value: unknown): FarmServer {
  if (value === undefined) return 'Global';
  const server = farmServers.find((server) => server === value);
  if (!server) throw new Error('Choose Global, JP or CN for farming recommendations.');
  return server;
}

const epsilon = 1e-6;
const gearKey = /^T\d+_\w+$/;
const poolKey = (key: string) => `pool_${key}`;
const whole = (value: number) => Math.max(0, Math.ceil(value - epsilon));
const generalVariable = (key: string) => `general_${key}`;
const choiceVariable = (key: string) => `choice_${key}`;

export function buildGearModel(
  data: GearFarmData, needed: Resources, server: FarmServer, multiplier: number, caps: WorldCaps,
  owned: Resources = {}
): GearProblem {
  if (!farmServers.includes(server) || ![1, 2, 3].includes(multiplier)) throw new Error('Invalid farming server or campaign multiplier.');
  const variables: Record<string, Resources> = {};
  const available = new Set<string>();
  const generalTypes = new Set<string>();
  const types = new Set<string>();
  let maxTier = 0;
  for (const [key, amount] of Object.entries(owned)) {
    if ((key.startsWith('G_') || key.startsWith('Choice_T')) && (!Number.isSafeInteger(amount) || amount < 0)) {
      throw new Error(`Invalid blueprint inventory: ${key}.`);
    }
  }
  for (const area of Object.keys(data.gear_rates).sort((first, second) => Number(first) - Number(second))) {
    if (caps[server] !== null && Number.parseInt(area) > caps[server]) continue;
    for (let stageNumber = 1; stageNumber <= 5; stageNumber++) {
      const stage = `${area}-${stageNumber}`;
      const drops = data.gear_drops[stage];
      if (!drops || drops.length < 3) throw new Error(`Gear drops are missing for ${stage}.`);
      const variable: Resources = { AP: 10 };
      for (const entry of data.gear_rates[area]) {
        const rates = server === 'CN' && entry.OldRates ? entry.OldRates : entry.Rates;
        if (rates.length < 3 || rates.some((value) => !Number.isFinite(value) || value < 0)) throw new Error(`Invalid drop rates for ${stage}.`);
        const general = entry.Tier === 'general';
        if (!general && (!Number.isInteger(Number(entry.Tier)) || Number(entry.Tier) < 1)) throw new Error(`Invalid gear tier for ${stage}.`);
        if (!general) maxTier = Math.max(maxTier, Number(entry.Tier));
        for (let index = 0; index < 3; index++) {
          const type = drops[index];
          types.add(type);
          const key = general ? poolKey(`G_${type}`) : `T${entry.Tier}_${type}`;
          variable[key] = (variable[key] ?? 0) + rates[index] * multiplier;
          if (rates[index] > 0) {
            if (general) generalTypes.add(type);
            else available.add(key);
          }
        }
      }
      variables[stage] = variable;
    }
  }
  const stages = structuredClone(variables);
  const model: GearModel = { optimize: 'AP', opType: 'min', variables, constraints: {} };
  const requirements: Resources = {};
  const recipes: Resources = {};
  const unavailable: string[] = [];
  for (const [key, amount] of Object.entries(needed)) {
    if (!gearKey.test(key)) continue;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`Invalid gear requirement: ${key}.`);
    if (amount === 0) continue;
    const [tier, type] = key.split('_');
    const cost = data.universal_bp_cost?.[tier];
    if (cost !== undefined && (!Number.isSafeInteger(cost) || cost <= 0)) throw new Error(`Invalid General Blueprint cost for ${tier}.`);
    const convertible = cost !== undefined && types.has(type) && Number(tier.slice(1)) <= maxTier;
    // World caps still restrict unreleased tiers, even when a General pool exists.
    if (!available.has(key) && !(convertible && generalTypes.has(type))) {
      unavailable.push(key);
      continue;
    }
    requirements[key] = amount;
    model.constraints[key] = { min: amount };
    const general = `G_${type}`;
    if (convertible && (generalTypes.has(type) || (owned[general] ?? 0) > 0)) {
      recipes[key] = cost;
      model.constraints[poolKey(general)] = { min: -(owned[general] ?? 0) };
      model.variables[generalVariable(key)] = { [key]: 1, [poolKey(general)]: -cost, [`conversions_${key}`]: 1 };
    }
    const choice = `Choice_${tier}`;
    if ((owned[choice] ?? 0) > 0) {
      model.constraints[poolKey(choice)] = { min: -owned[choice] };
      model.variables[choiceVariable(key)] = { [key]: 1, [poolKey(choice)]: -1, [`conversions_${key}`]: 1 };
    }
    if (model.variables[generalVariable(key)] || model.variables[choiceVariable(key)]) {
      model.constraints[`conversions_${key}`] = { max: amount };
    }
  }
  return { model, unavailable, needed, owned, requirements, recipes, stages };
}

function solveLinear(model: GearModel, solver: GearSolver): Resources {
  const solution = solver.Solve(structuredClone(model));
  if (typeof solution !== 'object' || solution === null || Array.isArray(solution) ||
    !('feasible' in solution) || solution.feasible !== true || !('bounded' in solution) || solution.bounded !== true ||
    !('result' in solution) || typeof solution.result !== 'number' || !Number.isFinite(solution.result)) {
    throw new Error('The farming model has no feasible bounded solution.');
  }
  const values: Resources = {};
  for (const key of Object.keys(model.variables)) {
    const value = (solution as Record<string, unknown>)[key] ?? 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -epsilon) throw new Error('Invalid farming allocation.');
    values[key] = Math.max(value, 0);
  }
  for (const [key, bounds] of Object.entries(model.constraints)) {
    const amount = Object.entries(model.variables).reduce((sum, [variable, coefficients]) => sum + (coefficients[key] ?? 0) * values[variable], 0);
    const tolerance = epsilon * Math.max(1, Math.abs(amount), Math.abs(bounds.min ?? 0), Math.abs(bounds.max ?? 0));
    if ((bounds.min !== undefined && amount < bounds.min - tolerance) || (bounds.max !== undefined && amount > bounds.max + tolerance)) {
      throw new Error('The farming solver returned an incomplete allocation.');
    }
  }
  return values;
}

function optimiseAllocation(model: GearModel, problem: GearProblem, solver: GearSolver): Resources {
  const solution = solveLinear(model, solver);
  const ap = Object.entries(model.variables).reduce((sum, [key, variable]) => sum + (variable.AP ?? 0) * solution[key], 0);
  const tieBreak = structuredClone(model);
  tieBreak.optimize = 'allocation';
  tieBreak.constraints.AP = { max: ap + epsilon };
  const choiceWeight = Object.entries(problem.requirements).reduce((sum, [key, amount]) => sum + amount * (problem.recipes[key] ?? 1), 1);
  for (const [key, variable] of Object.entries(tieBreak.variables)) {
    if (key.startsWith('general_')) variable.allocation = problem.recipes[key.slice('general_'.length)];
    else if (key.startsWith('choice_')) variable.allocation = choiceWeight;
  }
  // Preserve Choice boxes when equally efficient routes can use General drops instead.
  try { return solveLinear(tieBreak, solver); }
  catch { return solution; }
}

function stageCounts(problem: GearProblem, solution: Resources): Resources {
  return Object.fromEntries(Object.keys(problem.stages).flatMap((stage) => solution[stage] > epsilon ? [[stage, whole(solution[stage])]] : []));
}

function expectedDrops(problem: GearProblem, counts: Resources): Resources {
  const drops: Resources = {};
  for (const [stage, runs] of Object.entries(counts)) {
    for (const [key, rate] of Object.entries(problem.stages[stage])) drops[key] = (drops[key] ?? 0) + runs * rate;
  }
  return drops;
}

function integerChoices(problem: GearProblem, solution: Resources, drops: Resources): Resources {
  const choices: Resources = {};
  const tiers = [...new Set(Object.keys(problem.requirements).map((key) => key.split('_')[0]))];
  for (const tier of tiers) {
    let stock = problem.owned[`Choice_${tier}`] ?? 0;
    const entries = Object.keys(problem.requirements).filter((key) => key.startsWith(`${tier}_`)).map((key) => {
      const target = Math.min(solution[choiceVariable(key)] ?? 0, whole(problem.requirements[key] - (drops[key] ?? 0)));
      return { key, target, count: Math.max(0, Math.floor(target + epsilon)) };
    });
    for (const entry of entries) { choices[entry.key] = entry.count; stock -= entry.count; }
    if (stock < 0) throw new Error('The farming allocation exceeds owned Choice blueprints.');
    let extra = Math.min(stock, whole(entries.reduce((sum, entry) => sum + entry.target, 0)) - entries.reduce((sum, entry) => sum + entry.count, 0));
    entries.sort((first, second) => (second.target - second.count) - (first.target - first.count) || first.key.localeCompare(second.key));
    for (const entry of entries) {
      if (extra <= 0) break;
      if (entry.target - entry.count > epsilon) { choices[entry.key]++; extra--; }
    }
  }
  return choices;
}

function evaluateSchedule(problem: GearProblem, counts: Resources, choices: Resources) {
  const drops = expectedDrops(problem, counts);
  const conversions: Resources = {};
  const usedChoices: Resources = {};
  const generalNeeds: Resources = {};
  const deficits: Resources = {};
  for (const [key, amount] of Object.entries(problem.requirements)) {
    const shortage = whole(amount - (drops[key] ?? 0));
    usedChoices[key] = Math.min(choices[key] ?? 0, shortage);
    const generalCount = shortage - usedChoices[key];
    if (problem.recipes[key]) {
      conversions[key] = generalCount;
      const pool = poolKey(`G_${key.split('_')[1]}`);
      generalNeeds[pool] = (generalNeeds[pool] ?? 0) + generalCount * problem.recipes[key];
    } else if (generalCount > 0) deficits[key] = Math.max(amount - (drops[key] ?? 0) - usedChoices[key], 0);
  }
  for (const [pool, amount] of Object.entries(generalNeeds)) {
    const missing = amount - Math.floor((problem.owned[pool.slice('pool_'.length)] ?? 0) + (drops[pool] ?? 0) + epsilon);
    if (missing > 0) deficits[pool] = missing;
  }
  return { conversions, choices: usedChoices, deficits };
}

function repairSchedule(problem: GearProblem, counts: Resources, choices: Resources, solver: GearSolver): Resources {
  const evaluation = evaluateSchedule(problem, counts, choices);
  if (Object.keys(evaluation.deficits).length === 0) return counts;
  const repair: GearModel = { optimize: 'AP', opType: 'min', variables: problem.stages, constraints: {} };
  for (const [key, amount] of Object.entries(evaluation.deficits)) {
    if (!key.startsWith('pool_G_') || Object.values(problem.stages).some((stage) => (stage[key] ?? 0) > 0)) {
      repair.constraints[key] = { min: amount };
      continue;
    }
    // Older datasets can have owned General stock without General stage drops.
    // Cover the fractional conversion shortfall with ordinary drops in that case.
    const type = key.slice('pool_G_'.length);
    let stock = problem.owned[`G_${type}`] ?? 0;
    const keys = Object.keys(evaluation.conversions).filter((gear) => gear.endsWith(`_${type}`))
      .sort((first, second) => problem.recipes[first] - problem.recipes[second]);
    const drops = expectedDrops(problem, counts);
    for (const gear of keys) {
      const covered = Math.min(evaluation.conversions[gear], Math.floor(stock / problem.recipes[gear]));
      stock -= covered * problem.recipes[gear];
      const missing = problem.requirements[gear] - (drops[gear] ?? 0) - evaluation.choices[gear] - covered;
      if (missing > epsilon) repair.constraints[gear] = { min: missing };
    }
  }
  const additions = stageCounts(problem, solveLinear(repair, solver));
  const repaired = { ...counts };
  for (const [stage, runs] of Object.entries(additions)) repaired[stage] = (repaired[stage] ?? 0) + runs;
  if (Object.keys(evaluateSchedule(problem, repaired, choices).deficits).length) throw new Error('The rounded farming plan cannot cover its blueprint conversions.');
  return repaired;
}

function trimSchedule(problem: GearProblem, counts: Resources, choices: Resources): Resources {
  const trimmed = { ...counts };
  for (const stage of Object.keys(trimmed).sort((first, second) => trimmed[first] - trimmed[second] || first.localeCompare(second, undefined, { numeric: true }))) {
    let low = 0;
    let high = trimmed[stage];
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (Object.keys(evaluateSchedule(problem, { ...trimmed, [stage]: middle }, choices).deficits).length) low = middle + 1;
      else high = middle;
    }
    if (low) trimmed[stage] = low;
    else delete trimmed[stage];
  }
  return trimmed;
}

function finishPlan(problem: GearProblem, counts: Resources, choices: Resources): GearFarmPlan {
  const evaluation = evaluateSchedule(problem, counts, choices);
  if (Object.keys(evaluation.deficits).length) throw new Error('The farming allocation is incomplete.');
  const allocation: GearBlueprintAllocation = {
    remainingByGear: Object.fromEntries(Object.entries(problem.needed).filter(([key]) => gearKey.test(key))),
    choiceUsedByGear: {}, generalUsedByGear: {},
    specialLeftover: Object.fromEntries(Object.entries(problem.owned).filter(([key]) => key.startsWith('G_') || key.startsWith('Choice_T')))
  };
  for (const [key, amount] of Object.entries(evaluation.choices)) {
    if (!amount) continue;
    allocation.choiceUsedByGear[key] = amount;
    allocation.remainingByGear[key] -= amount;
    const choice = `Choice_${key.split('_')[0]}`;
    allocation.specialLeftover[choice] -= amount;
  }
  // The route chooses total conversions. Assign their owned portion first;
  // future drops remain in Remaining Needed until the user actually owns them.
  const conversionKeys = Object.keys(evaluation.conversions).sort((first, second) => problem.recipes[first] - problem.recipes[second] || first.localeCompare(second));
  for (const key of conversionKeys) {
    const general = `G_${key.split('_')[1]}`;
    const cost = problem.recipes[key];
    const count = Math.min(evaluation.conversions[key], Math.floor((allocation.specialLeftover[general] ?? 0) / cost));
    if (!count) continue;
    allocation.generalUsedByGear[key] = count * cost;
    allocation.remainingByGear[key] -= count;
    allocation.specialLeftover[general] -= count * cost;
  }
  const runs = Object.entries(counts).filter(([, count]) => count > 0).map(([stage, count]) => ({ stage, runs: count }))
    .sort((first, second) => second.runs - first.runs || first.stage.localeCompare(second.stage, undefined, { numeric: true }));
  return { runs, energy: runs.reduce((sum, row) => sum + row.runs * 10, 0), unavailable: problem.unavailable,
    allocation, generalConversions: Object.fromEntries(Object.entries(evaluation.conversions).filter(([, count]) => count > 0)) };
}

export function optimiseGearFarm(request: GearFarmRequest, solver: GearSolver): GearFarmPlan {
  const { data, needed, owned, server, multiplier, caps } = request;
  const problem = buildGearModel(data, needed, server, multiplier, caps, owned);
  if (!Object.keys(problem.requirements).length) return finishPlan(problem, {}, {});
  const solution = optimiseAllocation(problem.model, problem, solver);
  const counts = stageCounts(problem, solution);
  const choices = integerChoices(problem, solution, expectedDrops(problem, counts));
  const initial = finishPlan(problem, trimSchedule(problem, repairSchedule(problem, counts, choices, solver), choices), choices);
  if (!Object.values(choices).some((count) => count > 0)) return initial;
  // Re-optimise the route after rounding the shared Choice allocations to whole boxes.
  const pinned = structuredClone(problem.model);
  for (const key of Object.keys(problem.requirements)) {
    delete pinned.variables[choiceVariable(key)];
    pinned.constraints[key].min = problem.requirements[key] - (choices[key] ?? 0);
    if (pinned.constraints[`conversions_${key}`]) pinned.constraints[`conversions_${key}`].max = pinned.constraints[key].min;
  }
  const adjusted = stageCounts(problem, optimiseAllocation(pinned, problem, solver));
  const candidate = finishPlan(problem, trimSchedule(problem, repairSchedule(problem, adjusted, choices, solver), choices), choices);
  return candidate.energy < initial.energy ? candidate : initial;
}

export function farmedGeneralConversions(plan: GearFarmPlan, data: GearFarmData): FarmedGeneralConversion[] {
  const ownedRemainders = { ...plan.allocation.specialLeftover };
  const entries = Object.entries(plan.generalConversions).sort(([first], [second]) =>
    (data.universal_bp_cost?.[first.split('_')[0]] ?? 0) - (data.universal_bp_cost?.[second.split('_')[0]] ?? 0) || first.localeCompare(second));
  return entries.flatMap(([gear, total]) => {
    const [tier, type] = gear.split('_');
    const cost = data.universal_bp_cost?.[tier];
    if (!cost) return [];
    const blueprints = total - (plan.allocation.generalUsedByGear[gear] ?? 0) / cost;
    if (blueprints <= 0) return [];
    const general = `G_${type}`;
    // Fully owned conversions are already shown in the inventory table. A
    // remaining partial stock can still combine with drops for this conversion.
    const owned = Math.min(blueprints * cost, ownedRemainders[general] ?? 0);
    ownedRemainders[general] = (ownedRemainders[general] ?? 0) - owned;
    return [{ gear, general, blueprints, farmed: blueprints * cost - owned, owned }];
  });
}

export function decodeGearFarmPlan(value: unknown): GearFarmPlan {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item);
  const amounts = (item: unknown) => record(item) && Object.values(item).every((amount) => typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0);
  if (!record(value) || !Array.isArray(value.runs) || !value.runs.every((row) => record(row) && typeof row.stage === 'string' && /^\d+-[1-5]$/.test(row.stage) && typeof row.runs === 'number' && Number.isSafeInteger(row.runs) && row.runs > 0) ||
    !Number.isSafeInteger(value.energy) || !Array.isArray(value.unavailable) || !value.unavailable.every((key) => typeof key === 'string' && gearKey.test(key)) ||
    !record(value.allocation) || !['remainingByGear', 'choiceUsedByGear', 'generalUsedByGear', 'specialLeftover'].every((key) => amounts(value.allocation && (value.allocation as Record<string, unknown>)[key])) || !amounts(value.generalConversions)) {
    throw new Error('Invalid farming worker allocation.');
  }
  const plan = value as unknown as GearFarmPlan;
  if (plan.energy !== plan.runs.reduce((sum, row) => sum + row.runs * 10, 0) || new Set(plan.runs.map((row) => row.stage)).size !== plan.runs.length) throw new Error('Invalid farming worker AP total.');
  return plan;
}

export function gearResult(solution: unknown, unavailable: string[]): GearFarmResult {
  if (typeof solution !== 'object' || solution === null || Array.isArray(solution) ||
    !('feasible' in solution) || solution.feasible !== true || !('bounded' in solution) || solution.bounded !== true ||
    !('result' in solution) || typeof solution.result !== 'number' || !Number.isFinite(solution.result)) {
    throw new Error('The farming model has no feasible bounded solution.');
  }
  const runs: GearFarmResult['runs'] = [];
  let energy = 0;
  for (const [stage, value] of Object.entries(solution)) {
    if (!stage.includes('-')) continue;
    if (!/^\d+-[1-5]$/.test(stage) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('The farming solver returned invalid stage runs.');
    }
    const count = Math.ceil(value);
    runs.push({ stage, runs: count });
    energy += count * 10;
  }
  runs.sort((first, second) => second.runs - first.runs);
  return { runs, energy, unavailable };
}

export function leftoverBlueprintXp(owned: Resources, data: GearFarmData, equipment: string[]): number {
  return Object.entries(owned).reduce((sum, [key, amount]) =>
    equipment.includes(key) ? sum + amount * data.gear_bp_value[key.split('_')[0]] : sum, 0);
}
