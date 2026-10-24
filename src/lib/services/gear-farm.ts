import { decodeGearFarmPlan, type FarmServer, type GearFarmData, type WorldCaps } from '../domain/planner/gear-farm';
import type { Resources } from '../domain/resources/types';
import { isRecord } from '../domain/planner/save';
import { workerRequest, type WorkerRequestOptions } from './worker-request';

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
