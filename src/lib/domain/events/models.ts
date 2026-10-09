import { isRecord } from '../planner/save';
import type {
  CoreEvent,
  EnabledStageGroups,
  EventAmounts,
  EventModel,
  EventModelInputs,
  EventObjective,
} from './types';

const upgradeBaseAmounts: Readonly<Record<string, number>> = {
  Momoyodou_Glitter_Coin: 4200,
  Turban_Shell: 4200,
  Summer_Ninjutsu_Instructions_Scroll: 4110,
};

function setOwn<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}

function assertEvent(event: CoreEvent): void {
  if (!isRecord(event) || !isRecord(event.currencies) || !Array.isArray(event.stages)) throw new Error('Invalid event: currencies must be a record and stages must be an array.');
}

function assertGroups(groups: EnabledStageGroups): void {
  if (!Array.isArray(groups) || groups.length !== 3 || groups.some((group) => typeof group !== 'boolean')) throw new Error('Invalid enabled stage groups: expected three boolean flags.');
}

function assertAmounts(value: unknown, label: string): asserts value is EventAmounts;
function assertAmounts(value: unknown, label: string, allowNullish: true): asserts value is Record<string, number | null | undefined>;
function assertAmounts(value: unknown, label: string, allowNullish = false): void {
  if (!isRecord(value)) throw new Error(`Invalid ${label}: expected an amount record.`);
  for (const [name, amount] of Object.entries(value)) {
    if (allowNullish && (amount === null || amount === undefined)) continue;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`Invalid ${label} coefficient for "${name}": expected a finite number.`);
    }
  }
}

interface QuestStageData {
  number: number;
  group?: number;
  cost: unknown;
  drops: EventAmounts;
}

function questStageData(stage: unknown, index: number): QuestStageData | undefined {
  if (!isRecord(stage) || stage.type !== 'Quest') return undefined;
  if (typeof stage.number !== 'number' || !Number.isFinite(stage.number)) {
    throw new Error(`Quest stage at index ${index} is missing a finite stage number.`);
  }
  if (stage.group !== undefined && (typeof stage.group !== 'number' || !Number.isFinite(stage.group))) {
    throw new Error(`Quest stage at index ${index} has an invalid group.`);
  }
  if (!isRecord(stage.drops)) {
    throw new Error(`Quest stage at index ${index} is missing its drops record.`);
  }
  const drops = stage.drops;
  assertAmounts(drops, `Quest stage ${String(stage.number)} drops`);
  return {
    number: stage.number,
    ...(stage.group === undefined ? {} : { group: stage.group }),
    cost: stage.cost,
    drops,
  };
}

function assertInputs(inputs: EventModelInputs): void {
  // The legacy screen uses NaN as an inactive target for events without points.
  if (!isRecord(inputs) || typeof inputs.eventId !== 'string' || typeof inputs.upgradeBases !== 'boolean' ||
    typeof inputs.energyAvailable !== 'number' || !Number.isFinite(inputs.energyAvailable) ||
    typeof inputs.pointTarget !== 'number' || (inputs.pointTarget && !Number.isFinite(inputs.pointTarget)) ||
    !isRecord(inputs.needed)) throw new Error('Invalid event model inputs.');
  assertAmounts(inputs.bonuses, 'bonuses', true);
  assertGroups(inputs.enabledGroups);
}

function copyObjective(optimize: EventObjective): EventObjective {
  if (typeof optimize === 'string') return optimize;
  if (!isRecord(optimize)) throw new Error('Invalid objective: expected a string or objective record.');
  const copy: Record<string, 'max'> = {};
  for (const [name, direction] of Object.entries(optimize)) {
    if (direction !== 'max') throw new Error(`Invalid objective direction for "${name}".`);
    setOwn(copy, name, direction);
  }
  return copy;
}

export function buildStageVariables(event: CoreEvent, bonuses: EventAmounts, groups: EnabledStageGroups): Record<string, EventAmounts> {
  assertEvent(event);
  assertGroups(groups);
  assertAmounts(bonuses, 'bonuses', true);
  const currencyNames = new Set(Object.keys(event.currencies));
  const variables: Record<string, EventAmounts> = {};

  event.stages.forEach((stage, index) => {
    const quest = questStageData(stage, index);
    if (!quest) return;
    const coefficients: EventAmounts = {};
    setOwn(variables, String(quest.number), coefficients);
    if (
      (quest.group === 1 && !groups[0]) ||
      (quest.group === 2 && !groups[1]) ||
      (quest.group === 3 && !groups[2])
    ) return;

    for (const [name, rawDrop] of Object.entries(quest.drops)) {
      let coefficient = rawDrop;
      if (currencyNames.has(name)) {
        const bonus = bonuses[name] ?? 0;
        if (typeof bonus !== 'number' || !Number.isFinite(bonus)) {
          throw new Error(`Invalid bonus coefficient for "${name}".`);
        }
        const adjusted = rawDrop + rawDrop * bonus;
        if (!Number.isFinite(adjusted)) {
          throw new Error(`Nonfinite adjusted drop coefficient for "${name}" in quest ${quest.number}.`);
        }
        coefficient = Math.ceil(Number(adjusted.toFixed(5)));
      }
      if (!Number.isFinite(coefficient)) {
        throw new Error(`Nonfinite drop coefficient for "${name}" in quest ${quest.number}.`);
      }
      setOwn(coefficients, name, coefficient);
    }
    const cost = quest.cost;
    if (typeof cost !== 'number' || !Number.isFinite(cost)) {
      throw new Error(`Invalid energy cost coefficient in quest ${quest.number}.`);
    }
    setOwn(coefficients, 'Energy_Cost', cost);
  });
  return variables;
}

export function buildStageModel(
  event: CoreEvent, inputs: EventModelInputs, optimize: EventObjective,
  opType?: 'min' | 'max' | '' | null, energyConstrained = false,
): EventModel {
  assertEvent(event);
  assertInputs(inputs);
  const objective = copyObjective(optimize);
  if (opType !== undefined && opType !== null && opType !== '' && opType !== 'min' && opType !== 'max') {
    throw new Error('Invalid optimization type.');
  }
  if (typeof energyConstrained !== 'boolean') throw new Error('Invalid energy constraint flag.');

  const model: EventModel = {
    optimize: objective,
    ...(opType ? { opType } : {}),
    variables: buildStageVariables(event, inputs.bonuses, inputs.enabledGroups),
    constraints: {},
  };

  for (const name of Object.keys(inputs.needed)) {
    if (objective !== name && event.currencies[name]?.source === 'StageDrop') {
      let minimum = inputs.needed[name];
      if (typeof minimum !== 'number' || !Number.isFinite(minimum)) {
        throw new Error(`Invalid minimum constraint for "${name}".`);
      }
      if (inputs.eventId === 'momoyodou-beach-house' && inputs.upgradeBases) {
        if (!Object.prototype.hasOwnProperty.call(upgradeBaseAmounts, name)) {
          throw new Error(`Missing upgrade base amount for "${name}".`);
        }
        const baseAmount = upgradeBaseAmounts[name];
        if (typeof baseAmount !== 'number' || !Number.isFinite(baseAmount)) {
          throw new Error(`Missing or invalid upgrade base amount for "${name}".`);
        }
        minimum += baseAmount;
      }
      if (!Number.isFinite(minimum)) throw new Error(`Nonfinite minimum constraint for "${name}".`);
      setOwn(model.constraints, name, { min: minimum });
    }
  }

  if (energyConstrained) setOwn(model.constraints, 'Energy_Cost', { max: inputs.energyAvailable });
  if (inputs.pointTarget && objective !== 'Event_Point') {
    const neededPoints = inputs.needed.Event_Point ?? 0;
    if (typeof neededPoints !== 'number' || !Number.isFinite(neededPoints)) {
      throw new Error('Invalid Event_Point minimum constraint.');
    }
    const minimum = Math.max(inputs.pointTarget, neededPoints);
    if (!Number.isFinite(minimum)) throw new Error('Nonfinite Event_Point minimum constraint.');
    setOwn(model.constraints, 'Event_Point', { min: minimum });
  }
  return model;
}

export function materialDropOptions(event: CoreEvent): string[] {
  assertEvent(event);
  const currencyNames = new Set(Object.keys(event.currencies));
  const materials = new Set<string>();
  event.stages.forEach((stage, index) => {
    const quest = questStageData(stage, index);
    if (!quest) return;
    for (const name of Object.keys(quest.drops)) {
      if (!currencyNames.has(name)) materials.add(name);
    }
  });
  return [...materials].sort();
}

export function buildMaterialTargetModel(
  event: CoreEvent, inputs: EventModelInputs, targets: Record<string, boolean>,
): EventModel {
  if (!isRecord(targets)) throw new Error('Invalid material targets: expected a boolean record.');
  const objective: Record<string, 'max'> = {};
  for (const [name, selected] of Object.entries(targets)) {
    if (typeof selected !== 'boolean') throw new Error(`Invalid material target for "${name}".`);
    if (selected) setOwn(objective, name, 'max');
  }
  return buildStageModel(event, inputs, objective, '', true);
}
