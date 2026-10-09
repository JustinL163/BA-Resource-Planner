import type { resourceEngine } from './lib/domain/resources';
import type { eventEngine } from './lib/domain/events';
import type { runSimulation, simulationBudget } from './lib/services/simulations/runner';
import type { SimulationRequest } from './lib/services/simulations/types';
import type { Html2Canvas } from './lib/services/team-screenshot';
import type { studentSearch } from './lib/legacy/student-search';

declare global {
  interface Window {
    dataLayer?: unknown[];
    html2canvas?: Html2Canvas;
    BAStudentSearch: typeof studentSearch;
    BAResourceEngine: typeof resourceEngine;
    BAEventEngine: typeof eventEngine;
    BAEventSimulations: {
      budget: typeof simulationBudget;
      run: (request: SimulationRequest, options?: { signal?: AbortSignal }) => ReturnType<typeof runSimulation>;
    };
  }
}

export {};
