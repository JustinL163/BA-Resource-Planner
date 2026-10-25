export type EventAmounts = Record<string, number>;

export interface EventCurrency {
  source?: string;
  bonus_units: { id: string; bonus: number }[];
}

export interface EventStage {
  type: string;
  number?: number | null;
  group?: number;
  cost: number;
  drops?: EventAmounts;
  initial?: EventAmounts;
}

export interface CoreEvent {
  reset_time: number;
  start_time: number;
  end_time: number;
  maint_hours: number;
  currencies: Record<string, EventCurrency>;
  stages: EventStage[];
}

export interface EventEnergySettings {
  cafe_rank?: number | null;
  pyro_refreshes?: number | null;
  pvp_refreshes?: number | null;
  energy_pack?: boolean;
  energy_carryover?: number | null;
}

export interface EventEnergy {
  sources: {
    natural: number;
    cafe: number;
    daily: number;
    club: number;
    pyro: number;
    pvp: number;
    pack: number;
    carryover: number;
    weekly: number;
    arona: number;
  };
  total: number;
  available: number;
  resetsLeft: number;
  resetsTotal: number;
}

export type EnabledStageGroups = readonly [boolean, boolean, boolean];
export type EventObjective = string | Record<string, 'max'>;
export interface EventModel {
  optimize: EventObjective;
  opType?: 'min' | 'max';
  variables: Record<string, EventAmounts>;
  constraints: Record<string, { min?: number; max?: number }>;
}

export interface EventModelInputs {
  eventId: string;
  bonuses: EventAmounts;
  needed: EventAmounts;
  energyAvailable: number;
  pointTarget: number;
  enabledGroups: EnabledStageGroups;
  upgradeBases: boolean;
}
