import type { OmikujiDefinition } from '../domain/events/standard-types';
import { omikujiSimulationRequest } from '../domain/events/omikuji';
import { runSimulation } from './simulations/runner';
import { summarizeSimulationSamples, type CardSimulationOptions } from './card-simulation';

export async function simulateOmikuji(omikuji: OmikujiDefinition, currency: number, options: CardSimulationOptions = {}) {
  const request = omikujiSimulationRequest(omikuji, currency);
  const samples = await runSimulation(request, {
    baseUrl: new URL('/planner/', window.location.href),
    signal: options.signal,
    createWorker: options.createSimulationWorker
  });
  return summarizeSimulationSamples(samples, options);
}
