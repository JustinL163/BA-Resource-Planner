import type { GearFarmData } from '../planner/gear-farm';

export type InvestmentValue = number | string | null | undefined;
export type Resources = Record<string, number>;
export type BookType = 'HP' | 'ATK' | 'Heal';

export interface Investment {
  level?: InvestmentValue;
  bond?: InvestmentValue;
  star?: InvestmentValue;
  ue?: InvestmentValue;
  ue_level?: InvestmentValue;
  ex?: InvestmentValue;
  basic?: InvestmentValue;
  passive?: InvestmentValue;
  sub?: InvestmentValue;
  gear1?: InvestmentValue;
  gear2?: InvestmentValue;
  gear3?: InvestmentValue;
  bond_gear?: InvestmentValue;
  book_hp?: InvestmentValue;
  book_atk?: InvestmentValue;
  book_heal?: InvestmentValue;
}

export interface StudentPlan {
  id: string | number;
  current?: Investment;
  target?: Investment;
  eleph?: {
    owned?: InvestmentValue;
    unlocked?: boolean;
    cost?: InvestmentValue;
    purchasable?: InvestmentValue;
    farm_nodes?: InvestmentValue;
    use_eligma?: boolean;
    use_shop?: boolean;
  };
}

export interface StudentInfo {
  StarGrade: number;
  WeaponType: string;
  Equipment?: string[];
  SkillExMaterial?: number[][];
  SkillExMaterialAmount?: number[][];
  SkillMaterial?: number[][];
  SkillMaterialAmount?: number[][];
  PotentialMaterial?: number;
  Gear?: {
    TierUpMaterial?: number[][];
    TierUpMaterialAmount?: number[][];
  };
}

interface ShopPrice {
  amount: number;
  cost: number;
  times: number;
}

interface LimitBreakCost {
  books: number;
  credit: number;
  artifact_1: number;
  artifact_2?: number;
}

export interface ResourceData extends GearFarmData {
  skill_credit_cost: { ex: number[]; other: number[] };
  level_xp: number[];
  ue_xp: number[];
  cumulative_gear_cost: Record<string, Resources>;
  cumulative_mystic_cost: Record<string, { credit?: number; eleph?: number }>;
  cumulative_limit_break_cost: LimitBreakCost[];
  bond_gear_credit_cost: number[];
  gun_ue_category: Record<string, string>;
  shop_characters: Record<string, string | (ShopPrice & { currency: string })>;
  shop_eleph: Record<string, ShopPrice>;
  hard_modes: Record<string, unknown>;
  unlock_cost: Record<string, number>;
}

export interface ResourceContext {
  data: ResourceData;
  materialId: (name: string) => string | number | undefined;
}

export function integer(value: InvestmentValue): number {
  return Number.parseInt(String(value));
}

export function isZero(value: InvestmentValue): boolean {
  return value === 0 || (typeof value === 'string' && Number(value) === 0);
}

export function addResource(resources: Resources, key: string | number | undefined, amount: number): void {
  resources[String(key)] = (resources[String(key)] || 0) + amount;
}
