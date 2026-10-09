import type { GearModel, GearSolver } from '../domain/planner/gear-farm';

declare const self: {
  importScripts: (url: string) => void;
  solver?: GearSolver;
  onmessage: (event: MessageEvent<{ model: GearModel }>) => void;
  postMessage: (value: unknown) => void;
};

self.onmessage = (event) => {
  try {
    self.importScripts('/planner/packages/javascript-lp-solver/solver.js');
    if (!self.solver) throw new Error('The farming solver did not initialize.');
    self.postMessage({ ok: true, solution: self.solver.Solve(event.data.model) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Farming worker failed.' });
  }
};
