import { diceSimulationRequest } from '../domain/events/dice';
import type { DiceRace } from '../domain/events/standard-types';
import { runSimulation } from './simulations/runner';
import { summarizeSimulationSamples, type CardSimulationOptions } from './card-simulation';

export async function simulateDice(race: DiceRace, currency: number, options: CardSimulationOptions = {}) {
  const samples = await runSimulation(diceSimulationRequest(race, currency), {
    baseUrl: new URL('/planner/', window.location.href), signal: options.signal, createWorker: options.createSimulationWorker
  });
  return summarizeSimulationSamples(samples, options);
}
