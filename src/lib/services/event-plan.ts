import { isRecord } from '../domain/planner/save';
import type { EventModel } from '../domain/events/types';
import { workerRequest, type WorkerRequestOptions } from './worker-request';

export function solveEventPlan(model: EventModel, options: WorkerRequestOptions = {}): Promise<unknown> {
  return workerRequest(new URL('/planner/js/shared/event-plan-worker.js', window.location.href), { model }, (value) => {
    if (!isRecord(value) || typeof value.ok !== 'boolean') throw new Error('Invalid event worker response.');
    if (!value.ok) throw new Error(typeof value.error === 'string' ? value.error : 'Event worker failed.');
    if (!isRecord(value.solution)) throw new Error('Invalid event solver result.');
    return { type: 'result', value: value.solution };
  }, options);
}
