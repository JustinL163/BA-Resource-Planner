import type { EventModel } from '../domain/events/types';

declare const self: {
  importScripts: (url: string) => void;
  solver?: { Solve(model: EventModel): unknown };
  onmessage: (event: MessageEvent<{ model: EventModel }>) => void;
  postMessage: (value: unknown) => void;
};

self.onmessage = (event) => {
  try {
    self.importScripts('/planner/packages/javascript-lp-solver/solver.js');
    if (!self.solver) throw new Error('The event solver did not initialize.');
    self.postMessage({ ok: true, solution: self.solver.Solve(event.data.model) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Event worker failed.' });
  }
};
