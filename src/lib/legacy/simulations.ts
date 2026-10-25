import { runSimulation, simulationBudget } from '../services/simulations/runner';
import type { SimulationRequest } from '../services/simulations/types';

window.BAEventSimulations = {
  budget: simulationBudget,
  run: (request: SimulationRequest, options: { signal?: AbortSignal } = {}) =>
    runSimulation(request, { ...options, baseUrl: new URL('/planner/', window.location.href) })
};
