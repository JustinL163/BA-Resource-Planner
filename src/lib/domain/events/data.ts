import { isRecord } from '../planner/save';
import type { CoreEvent, EventAmounts, EventCurrency, EventStage } from './types';

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid event ${label}.`);
  return value;
}

function amounts(value: unknown, label: string): EventAmounts {
  if (!isRecord(value)) throw new Error(`Invalid event ${label}.`);
  return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, finite(amount, `${label} ${key}`)]));
}

export function decodeCoreEvent(value: unknown): CoreEvent {
  if (!isRecord(value) || !isRecord(value.currencies) || !Array.isArray(value.stages)) {
    throw new Error('Invalid event definition.');
  }
  const currencies: Record<string, EventCurrency> = {};
  for (const [key, currency] of Object.entries(value.currencies)) {
    if (!isRecord(currency) || (currency.source !== undefined && typeof currency.source !== 'string') || !Array.isArray(currency.bonus_units)) {
      throw new Error(`Invalid event currency ${key}.`);
    }
    currencies[key] = {
      source: currency.source,
      bonus_units: currency.bonus_units.map((unit: unknown) => {
        if (!isRecord(unit) || typeof unit.id !== 'string') throw new Error(`Invalid bonus character for ${key}.`);
        return { id: unit.id, bonus: finite(unit.bonus, `bonus ${unit.id}`) };
      })
    };
  }
  const stages: EventStage[] = value.stages.map((stage: unknown) => {
    if (!isRecord(stage) || typeof stage.type !== 'string') throw new Error('Invalid event stage.');
    const result: EventStage = { type: stage.type, cost: finite(stage.cost, 'stage cost') };
    if (stage.number !== undefined) result.number = stage.number === null ? null : finite(stage.number, 'stage number');
    if (stage.group !== undefined) result.group = finite(stage.group, 'stage group');
    if (stage.drops !== undefined) result.drops = amounts(stage.drops, 'stage drops');
    if (stage.initial !== undefined) result.initial = amounts(stage.initial, 'initial rewards');
    return result;
  });
  return {
    reset_time: finite(value.reset_time, 'reset time'),
    start_time: finite(value.start_time, 'start time'),
    end_time: finite(value.end_time, 'end time'),
    maint_hours: finite(value.maint_hours, 'maintenance hours'),
    currencies, stages
  };
}
