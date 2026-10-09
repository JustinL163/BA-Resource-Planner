import type { PlannerMetadata, ResourceTotals } from './types';

export interface ResourceItem {
  key: string;
  name: string;
  group: string;
  image?: string;
}

export function resourceItem(key: string, metadata: PlannerMetadata): ResourceItem {
  const name = metadata.materialNames[key] ?? key;
  let group = 'Other';
  if (metadata.equipment.includes(key)) group = 'Equipment';
  else if (key.startsWith('XP_') || key.startsWith('GXP_')) group = 'XP items';
  else if (/^T[1-4]_(Spring|Hammer|Barrel|Needle)$/.test(key)) group = 'Weapon items';
  else if (Number(key) >= 100 && Number(key) < 1000) group = 'Artifacts';
  else if (Number(key) >= 3000 && Number(key) < 5000) group = 'School materials';
  else if (Number(key) >= 5000 && Number(key) < 9999) group = 'Gifts';
  else if (Number(key) >= 2000 && Number(key) < 3000) group = 'Limit break books';
  else if (key === 'Credit' || key === 'Eligma') group = 'Currency';
  return { key, name: name.replaceAll('_', ' '), group, image: metadata.images[key] };
}

export function inventoryCatalog(metadata: PlannerMetadata, totals: ResourceTotals): ResourceItem[] {
  const keys = new Set([...Object.keys(metadata.materialNames), ...metadata.equipment, ...Object.keys(totals.owned), 'Credit', 'Eligma']);
  for (let tier = 1; tier <= 4; tier++) {
    keys.add(`XP_${tier}`); keys.add(`GXP_${tier}`);
    for (const type of ['Spring', 'Hammer', 'Barrel', 'Needle']) keys.add(`T${tier}_${type}`);
  }
  return [...keys].filter((key) => !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(key) && !key.endsWith('Cost'))
    .map((key) => resourceItem(key, metadata));
}

export function formatAmount(value: number | string | undefined): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return String(number);
  return number.toLocaleString('en-US', { maximumFractionDigits: 20 });
}
