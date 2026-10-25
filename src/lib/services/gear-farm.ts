import { decodeGearFarmPlan, type FarmServer, type GearFarmData, type GearFarmPlan, type WorldCaps } from '../domain/planner/gear-farm';
import type { Resources } from '../domain/resources/types';
import { isRecord } from '../domain/planner/save';
import { workerRequest, type WorkerRequestOptions } from './worker-request';

const completedPlans = new Map<string, GearFarmPlan>();
const maxCachedPlans = 8;

export function getCachedGearFarmPlan(key: string) {
  const plan = completedPlans.get(key);
  if (plan) {
    completedPlans.delete(key);
    completedPlans.set(key, plan);
  }
  return plan ?? null;
}

export function cacheGearFarmPlan(key: string, plan: GearFarmPlan) {
  completedPlans.delete(key);
  completedPlans.set(key, plan);
  if (completedPlans.size > maxCachedPlans) {
    const oldestKey = completedPlans.keys().next().value;
    if (oldestKey !== undefined) completedPlans.delete(oldestKey);
  }
}

export function recommendGear(
  data: GearFarmData, needed: Resources, owned: Resources, server: FarmServer, multiplier: number, caps: WorldCaps,
  options: WorkerRequestOptions = {}
) {
  return workerRequest(new URL('/planner/js/shared/gear-farm-worker.js', window.location.href), { data, needed, owned, server, multiplier, caps }, (value) => {
    if (!isRecord(value) || typeof value.ok !== 'boolean') throw new Error('Invalid farming worker response.');
    if (!value.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Farming worker failed.');
    return { type: 'result', value: decodeGearFarmPlan(value.result) };
  }, options);
}
