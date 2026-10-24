import type { PlannerMetadata, ResourceTotals } from './types';

export interface ResourceItem {
  key: string;
  name: string;
  group: string;
  image?: string;
}

export function resourceItem(key: string, metadata: PlannerMetadata): ResourceItem {
  const name = metadata.materialNames[key] ?? key;
  const imageKey = key.endsWith('Cost') ? key.slice(0, -4) : key;
  let group = 'Other';
  if (metadata.equipment.includes(key) || /^Choice_T(?:[2-9]|10)$/.test(key) ||
    (key.startsWith('G_') && metadata.equipment.some((equipment) => equipment.endsWith(`_${key.slice(2)}`)))) group = 'Equipment';
  else if (key.startsWith('XP_') || key.startsWith('GXP_')) group = 'XP items';
  else if (/^T[1-4]_(Spring|Hammer|Barrel|Needle)$/.test(key)) group = 'Weapon items';
  else if (Number(key) >= 100 && Number(key) < 1000) group = 'Artifacts';
  else if (Number(key) >= 3000 && Number(key) < 5000) group = 'School materials';
  else if (Number(key) >= 5000 && Number(key) < 9999) group = 'Gifts';
  else if (Number(key) >= 2000 && Number(key) < 3000) group = 'Limit break books';
  else if (['Credit', 'Eligma', 'BountyCoin'].includes(key) || key === 'BountyCoinCost') group = 'Currency';
  return { key, name: name.replaceAll('_', ' '), group, image: metadata.images[key] ?? metadata.images[imageKey] };
}

export function inventoryCatalog(metadata: PlannerMetadata, totals: ResourceTotals): ResourceItem[] {
  const generatedKeys: string[] = [];
  for (let tier = 1; tier <= 4; tier++) {
    generatedKeys.push(`XP_${tier}`, `GXP_${tier}`);
    for (const type of ['Spring', 'Hammer', 'Barrel', 'Needle']) generatedKeys.push(`T${tier}_${type}`);
  }
  const generated = new Set(generatedKeys);
  // Append owned-only keys last so changing a value cannot move an existing cell.
  const keys = new Set([
    ...Object.keys(metadata.materialNames).filter((key) => !generated.has(key)), ...metadata.equipment,
    'Credit', 'Eligma', ...generatedKeys, ...Object.keys(totals.owned)
  ]);
  return [...keys].filter((key) => !['Xp', 'GearXp', 'Eleph', 'ShopResets'].includes(key) && !key.endsWith('Cost'))
    .map((key) => resourceItem(key, metadata));
}

export function formatAmount(value: number | string | undefined): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return String(number);
  return number.toLocaleString('en-US', { maximumFractionDigits: 20 });
}
