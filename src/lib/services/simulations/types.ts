export type RewardArrays = Record<string, number[]>;
export type SimulationKind = 'card' | 'omikuji' | 'dice';

interface SimulationBase {
  currencyOwned: number | string;
}

export type SimulationRequest =
  | (SimulationBase & {
      kind: 'card';
      rewards: { drops: Record<string, number> }[];
      chances: number[][];
    })
  | (SimulationBase & {
      kind: 'omikuji';
      rewards: [number, number[], number[]][];
      chances: number[][];
      pullCost: number;
      targetGrade: number;
    })
  | (SimulationBase & {
      kind: 'dice';
      race: {
        roll_cost: number;
        tiles: { type?: string; id?: string; amount?: number }[];
        lap_reward_tiers: number[];
        lap_rewards: { type?: string; id?: string; amount?: number }[][];
      };
      targets: number[][];
      tickets: number[];
    });

export interface SimulationWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: readonly unknown[]): void;
  terminate(): void;
}

export interface SimulationOptions {
  baseUrl: URL;
  signal?: AbortSignal;
  createWorker?: (url: URL) => SimulationWorker;
}
