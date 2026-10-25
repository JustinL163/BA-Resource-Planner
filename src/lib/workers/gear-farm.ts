import { optimiseGearFarm, type GearFarmRequest, type GearSolver } from '../domain/planner/gear-farm';

declare const self: {
  importScripts: (url: string) => void;
  solver?: GearSolver;
  onmessage: (event: MessageEvent<GearFarmRequest>) => void;
  postMessage: (value: unknown) => void;
};

self.onmessage = (event) => {
  try {
    self.importScripts('/planner/packages/javascript-lp-solver/solver.js');
    if (!self.solver) throw new Error('The farming solver did not initialize.');
    self.postMessage({ ok: true, result: optimiseGearFarm(event.data, self.solver) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Farming worker failed.' });
  }
};
