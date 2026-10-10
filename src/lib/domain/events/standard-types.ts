import type { CharacterInfo, PlannerMetadata } from '../planner/types';
import type { CoreEvent, EventAmounts, EventCurrency, EventEnergy, EventEnergySettings, EventStage } from './types';

export type EventMode = '' | 'Shop' | 'Materials' | 'Currency' | 'Manual';
export type EventTab = 'Targets' | 'Energy' | 'Bonus' | 'Shop' | 'Stages' | 'Points' | 'Boxes' | 'Cards' | 'Dice' | 'Omikuji' | 'Lessons' | 'Owned';
export interface OmikujiSlip {
  Grade: number;
  Prob: number;
  ProbModifyValue: number;
  ProbModifyLimit: number;
  RewardId: number[];
  RewardAmount: number[];
}
export interface OmikujiDefinition {
  pull_currency: string;
  pull_cost: number;
  TargetGrade: number;
  ProbModifyStartCount: number;
  MaxPullCount: number;
  slips: OmikujiSlip[];
}
export interface LessonLocation {
  name1: string;
  name2: string;
  unlock_rank: number;
  unlock_2: number;
  id_swap: Record<string, string>;
}
export interface LessonReward {
  type: string;
  id?: string;
  count?: number;
  chance?: number;
}
export interface LessonDefinition {
  locations: LessonLocation[];
  rank_upgrades: number[];
  level_unlocks: number[];
  lesson_cost: number;
  rewards: LessonReward[][];
}
export interface InvasionStage {
  number: number;
  level: number;
  initial: EventAmounts;
  initial_key: string[];
  drops: EventAmounts;
  drop_key: string[];
}
export interface InvasionDefinition {
  max_stage: number;
  daily_attempts: number;
  first_day_attempts: number;
  stages: InvasionStage[];
}
export interface DerivedCurrencyRule { from: string; to: string; multiplier: number }
export interface InvasionRewards {
  currencies: EventAmounts;
  eleph: EventAmounts;
  xps: EventAmounts;
  credit: number;
}
export interface EventReward {
  id: string | number;
  type: string;
  count: number;
  amount?: number;
}
export interface ShopItem extends EventReward { cost: number; default?: number; locked?: boolean; overflow?: boolean; overflow_cap?: number }
export interface PointReward extends EventReward { points: number }
export interface BoxCycle { cycle: string[]; rewards: (EventReward & { amount: number })[] }
export interface BoxEvent { boxes: BoxCycle[]; box_clear_cost: number }
export interface CardDraw { icon: string; chance: number; chance4?: number; drops: EventAmounts }
export type CardStatistics = Record<string, { mean: number; std: number }>;
export interface CardSimulationResult { statistics: CardStatistics; sampleCount: number }
export interface DiceReward { type: string; id?: string; amount?: number }
export interface DiceRace {
  roll_currency: string;
  roll_cost: number;
  tiles: DiceReward[];
  lap_reward_tiers: number[];
  lap_rewards: DiceReward[][];
}
export interface BoxRewards {
  clears: number;
  leftoverPercent: string;
  artifacts: EventAmounts;
  schoolMats: EventAmounts;
  eleph: EventAmounts;
  xps: EventAmounts;
  credit: number;
  eligma: number;
  secretTech: number;
  currency: number;
  currencyName: string;
}
export interface StandardEvent extends CoreEvent {
  eventId?: string;
  display_name: string;
  icon: string;
  active?: boolean;
  event_point_target?: number;
  derivedCurrencyRules?: DerivedCurrencyRule[];
  available_targets: Exclude<EventMode, ''>[];
  currency_targets: string[];
  stage_groups: string[];
  currencies: Record<string, EventCurrency & { icon: string; shortname: string; clear?: number; pull_currency?: string }>;
  stages: (EventStage & { label?: string; visible?: boolean })[];
  shops: Record<string, ShopItem[]>;
  point_rewards?: PointReward[];
  boxes?: BoxCycle[];
  box_clear_cost?: number;
  card_drops?: CardDraw[];
  dice_race?: DiceRace;
  omikuji?: OmikujiDefinition;
  lessons?: LessonDefinition;
  invasion?: InvasionDefinition;
}
export type SavedAmounts = Record<string, number | string>;
export interface EventPlan extends EventEnergySettings, Record<string, unknown> {
  enabled_bonus_units: string[];
  shop_purchases: Record<string, SavedAmounts>;
  currency_needed: SavedAmounts;
  currency_owned: SavedAmounts;
  enabled_stage_groups: [boolean, boolean, boolean];
  point_target?: number | string | null;
  optimisation_type: EventMode;
  optimisation_options: string | Record<string, boolean> | SavedAmounts | null;
  standard_deviation?: number;
  card_pull_rewards?: CardStatistics;
  card_pull_currency_owned?: number;
  dice_roll_rewards?: CardStatistics;
  dice_roll_currency_owned?: number;
  omikuji_pull_rewards?: CardStatistics;
  omikuji_pull_currency_owned?: number;
  lesson_pre_runs?: number[];
  lesson_post_runs?: SavedAmounts;
}
export interface EventRequirements {
  needed: EventAmounts;
  pointTarget: number;
  midEvent: boolean;
  initial: { rewards: EventAmounts; cost: number };
}
export interface EventSummary {
  runs: EventAmounts;
  currencies: EventAmounts;
  artifacts: EventAmounts;
  schoolMats: EventAmounts;
  eleph: EventAmounts;
  xps: EventAmounts;
  gear: EventAmounts;
  credit: number;
  eligma: number;
  secretTech: number;
  energy: number;
  feasible: boolean;
  boxes?: { clears: number; leftoverPercent: string };
  gearBoxes?: number;
  overflowPurchases?: Record<string, Record<string, number>>;
}
export interface EventActions {
  setMode(mode: Exclude<EventMode, ''>): boolean;
  setMaterials(materials: Record<string, boolean>): boolean;
  setCurrency(currency: string): boolean;
  setEnergy(key: keyof EventEnergySettings, value: number | boolean): boolean;
  setBonusIds(ids: string[]): boolean;
  setOwnedCurrency(currency: string, value: number): boolean;
  setPointTarget(value: number): boolean;
  setGroups(groups: [boolean, boolean, boolean]): boolean;
  setPurchase(currency: string, item: string, count: number): boolean;
  setManualRuns(stage: number, count: number): boolean;
  setStandardDeviation(value: number): boolean;
  setLessonPreRuns(runs: number[]): boolean;
  setLessonPostRuns(runs: SavedAmounts): boolean;
  resetLessons(): boolean;
}
export interface EventSettingsProps {
  tab: EventTab;
  event: StandardEvent;
  plan: EventPlan;
  budget: EventEnergy | null;
  bonuses: EventAmounts;
  materials: string[];
  students: Record<string, CharacterInfo>;
  names: Record<string, string>;
  metadata: PlannerMetadata;
  actions: EventActions;
  t: (key: string) => string;
}
