import type { ResourceContext, Resources, StudentInfo, StudentPlan, InvestmentValue } from '../resources/types';
import type { WorldCaps } from './gear-farm';

export const investmentKeys = [
  'level', 'bond', 'star', 'ue', 'ue_level', 'ex', 'basic', 'passive', 'sub',
  'gear1', 'gear2', 'gear3', 'bond_gear', 'book_hp', 'book_atk', 'book_heal'
] as const;
export type InvestmentKey = (typeof investmentKeys)[number];
export type FullInvestment = Record<InvestmentKey, InvestmentValue> & Record<string, unknown>;
export type OwnedInventory = Record<string, number | string>;

export interface CharacterInfo extends StudentInfo {
  Id: number;
  Name: string;
  School: string;
  SquadType: string;
  BulletType: string;
  ArmorType: string;
  Skills?: unknown;
}

export interface ElephState extends Record<string, unknown> {
  owned: number | string;
  unlocked: boolean;
  cost: number | string;
  purchasable: number | string;
  farm_nodes: number | string;
  node_refresh: boolean;
  use_eligma: boolean;
  use_shop: boolean;
}

export interface PlannerCharacter extends StudentPlan, Record<string, unknown> {
  id: string;
  name: string;
  current: FullInvestment;
  target: FullInvestment;
  eleph: ElephState;
  enabled: boolean;
  hasBondGear: boolean;
}

export interface PlannerSave extends Record<string, unknown> {
  exportVersion: 2;
  characters: PlannerCharacter[];
  character_order: string[];
  disabled_characters: string[];
  owned_materials: OwnedInventory;
  groups: Record<string, unknown>;
  language: string;
}

export interface InvestmentField {
  key: InvestmentKey;
  label: string;
  min: number;
  max: number;
  targetDefault: number | string;
}

export interface PlannerMetadata {
  materialNames: Record<string, string>;
  equipment: string[];
  colours: Record<string, string>;
  rowColours: Record<string, string>;
  images: Record<string, string>;
  portraits: Record<string, string>;
  scribblePortraits: Record<string, string>;
  fields: InvestmentField[];
  maxLevel: number;
  worldCaps: WorldCaps;
}

export interface PlannerDataset {
  students: Record<string, CharacterInfo>;
  context: ResourceContext;
}

export interface ResourceTotals {
  required: Resources;
  needed: Resources;
  leftover: Resources;
  owned: OwnedInventory;
  perCharacter: Record<string, Resources>;
}
