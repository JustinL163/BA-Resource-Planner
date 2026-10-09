import type { Resources } from '../resources/types';

export const farmServers = ['Global', 'JP', 'CN'] as const;
export type FarmServer = (typeof farmServers)[number];
export interface GearFarmData {
  gear_rates: Record<string, { Tier: string | number; Rates: number[]; OldRates?: number[] }[]>;
  gear_drops: Record<string, string[]>;
  gear_bp_value: Record<string, number>;
}
export type WorldCaps = Record<FarmServer, number | null>;
export interface GearModel {
  optimize: 'AP';
  opType: 'min';
  variables: Record<string, Resources>;
  constraints: Record<string, { min: number }>;
}
export interface GearFarmResult {
  runs: { stage: string; runs: number }[];
  energy: number;
  unavailable: string[];
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

export function buildGearModel(data: GearFarmData, needed: Resources, server: FarmServer, multiplier: number, caps: WorldCaps) {
  if (!farmServers.includes(server) || ![1, 2, 3].includes(multiplier)) throw new Error('Invalid farming server or campaign multiplier.');
  const variables: Record<string, Resources> = {};
  const available = new Set<string>();
  for (const area of Object.keys(data.gear_rates)) {
    if (caps[server] !== null && Number.parseInt(area) > caps[server]) break;
    for (let stageNumber = 1; stageNumber <= 5; stageNumber++) {
      const stage = `${area}-${stageNumber}`;
      const drops = data.gear_drops[stage];
      if (!drops || drops.length < 3) throw new Error(`Gear drops are missing for ${stage}.`);
      const variable: Resources = {};
      for (const entry of data.gear_rates[area]) {
        const rates = server === 'CN' && entry.OldRates ? entry.OldRates : entry.Rates;
        if (rates.length < 3 || rates.some((value) => !Number.isFinite(value) || value < 0)) throw new Error(`Invalid drop rates for ${stage}.`);
        for (let index = 0; index < 3; index++) {
          const key = `T${entry.Tier}_${drops[index]}`;
          variable[key] = rates[index] * multiplier;
          available.add(key);
        }
        variable.AP = 10;
      }
      variables[stage] = variable;
    }
  }
  const model: GearModel = { optimize: 'AP', opType: 'min', variables, constraints: {} };
  for (const [key, amount] of Object.entries(needed)) {
    if ((!Number.isFinite(amount) || amount < 0) && /^T\d+_/.test(key)) throw new Error(`Invalid gear requirement: ${key}.`);
    if (available.has(key) && amount !== 0) model.constraints[key] = { min: amount };
  }
  const unavailable = Object.keys(needed).filter((key) => /^T\d+_/.test(key) && needed[key] > 0 && !available.has(key));
  return { model, unavailable };
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
