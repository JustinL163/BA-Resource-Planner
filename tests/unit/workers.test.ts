import { describe, expect, it } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { readSource, seededRandom } from './legacy-harness';

function runWorker(file: string, message: unknown, seed = 163, globals: Record<string, unknown> = {}) {
  const results: unknown[] = [];
  let closed = false;
  const math: Math = Object.create(Math);
  math.random = seededRandom(seed);
  const context = createContext({
    Math: math,
    postMessage(result: unknown) { results.push(result); },
    self: { close() { closed = true; } },
    ...globals,
    message
  });
  runInContext(readSource('planner', 'js', file), context, { filename: file });
  runInContext('onmessage({ data: message });', context);
  return { context, results: JSON.parse(JSON.stringify(results)), isClosed: () => closed };
}

const cards = [
  { drops: { Credit: 100, Eligma: 2 } },
  { drops: { Credit: 20 } },
  { drops: { Credit: 5, Artifact: 1 } },
  { drops: { Credit: 1 } }
];
const cardChances = [
  [0.1, 0.3, 0.6, 1], [0.2, 0.5, 0.8, 1],
  [0.3, 0.6, 0.9, 1], [0.4, 0.7, 0.95, 1]
];
const diceRace = {
  roll_cost: 10,
  tiles: [
    { type: 'Credit', amount: 1 },
    { type: 'FixedDice', amount: 1 },
    { type: 'Credit', amount: 10 },
    { type: 'MoveBonus', amount: 1 },
    { type: 'Credit', amount: 20 },
    { id: 'Artifact', amount: 2 },
    { type: 'Credit', amount: 30 },
    { type: 'Credit', amount: 40 }
  ],
  lap_reward_tiers: [1, 2],
  lap_rewards: [
    [{ type: 'FixedDice', amount: 1 }, { type: 'Credit', amount: 50 }],
    [{ id: 'Artifact', amount: 3 }]
  ]
};

describe('legacy simulation worker baseline', () => {
  it('pins card rewards with a controlled random sequence', () => {
    const worker = runWorker('cardGachaWorker.js', [cards, cardChances, 3000, 12, 2000]);
    expect(worker.results).toMatchSnapshot();
    expect(worker.isClosed()).toBe(true);
  });

  it('pins omikuji rewards and escalating pull probabilities', () => {
    const worker = runWorker('omikujiGachaWorker.js', [
      [[1, ['Eleph'], [1]], [2, ['Eleph', 'Artifact'], [2, 1]], [3, ['Eleph'], [5]]],
      [[0, 5000, 8000], [0, 3000, 7000], [0, 1000, 5000]],
      3000, 12, 200, 10, 2
    ]);
    expect(worker.results).toMatchSnapshot();
    expect(worker.isClosed()).toBe(true);
  });

  it('pins dice movement, tickets and lap rewards', () => {
    const targets = Array.from({ length: diceRace.tiles.length }, () => [1, 2]);
    const worker = runWorker('diceGachaWorker.js', [diceRace, targets, 3000, 12, 100, [1, 1, 0, 0, 0, 0]]);
    expect(worker.results).toMatchSnapshot();
    expect(worker.isClosed()).toBe(true);
  });

  it.each(['cardGachaWorker.js', 'omikujiGachaWorker.js'])('%s handles no affordable pulls', (file) => {
    const message = file === 'cardGachaWorker.js'
      ? [cards, cardChances, 3000, 3, 0]
      : [[[1, ['Eleph'], [1]], [2, ['Eleph'], [2]]], [[0, 5000]], 3000, 3, 0, 10, 2];
    expect(runWorker(file, message).results).toMatchSnapshot();
  });

  it('preserves reusable dice-worker messages and explicit shutdown', () => {
    const worker = runWorker('diceGachaWorker.js', [
      diceRace, Array.from({ length: diceRace.tiles.length }, () => []),
      3000, 3, 50, [], 0, true
    ]);
    expect(worker.results).toMatchSnapshot();
    expect(worker.isClosed()).toBe(false);
    runInContext('onmessage({ data: "sudoku" });', worker.context);
    expect(worker.isClosed()).toBe(true);
  });

  it.each(['cardGachaWorker.js', 'omikujiGachaWorker.js', 'diceGachaWorker.js'])(
    '%s preserves the timeout and minimum-trial boundary',
    (file) => {
      let elapsed = 0;
      class Clock extends Date {
        constructor() { super(elapsed += 1000); }
      }
      const message = file === 'cardGachaWorker.js'
        ? [cards, cardChances, 3000, 100000, 0]
        : file === 'omikujiGachaWorker.js'
          ? [[[1, ['Eleph'], [1]], [2, ['Eleph'], [2]]], [[0, 5000]], 3000, 100000, 0, 10, 2]
          : [diceRace, Array.from({ length: diceRace.tiles.length }, () => []), 3000, 100000, 0, []];
      const worker = runWorker(file, message, 163, { Date: Clock });
      const rewards: Record<string, number[]> = worker.results[0];
      expect(Object.values(rewards).every((values) => values.length === 3000)).toBe(true);
      expect(worker.isClosed()).toBe(true);
    }
  );
});
