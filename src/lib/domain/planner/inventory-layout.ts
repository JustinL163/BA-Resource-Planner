import { inventoryCatalog, resourceItem, type ResourceItem } from './catalog';
import type { PlannerMetadata, ResourceTotals } from './types';

export interface MaterialRow { name: string; colour?: string; cells: (ResourceItem | undefined)[] }
export interface MaterialPanel { title: string; columns: string[]; rows: MaterialRow[] }

export function inventoryLayout(metadata: PlannerMetadata, totals: ResourceTotals, gear: boolean) {
  const catalog = inventoryCatalog(metadata, totals);
  const matrices = new Set<string>();
  const panels: MaterialPanel[] = [];
  if (gear) {
    const types = [...new Set(metadata.equipment.map((key) => key.split('_')[1]))];
    const tiers = [...new Set(metadata.equipment.map((key) => key.split('_')[0]))];
    panels.push({
      title: 'footer-gear', columns: types,
      rows: tiers.map((tier) => ({
        name: tier, cells: types.map((type) => {
          const key = `${tier}_${type}`;
          matrices.add(key);
          return catalog.find((item) => item.key === key);
        })
      }))
    });
  } else {
    for (const prefix of ['BD', 'TN', 'Artifacts']) {
      const items = catalog.filter((item) => prefix === 'Artifacts' ? item.group === 'Artifacts' :
        metadata.materialNames[item.key]?.startsWith(`${prefix}_`));
      const rows = new Map<string, MaterialRow>();
      for (const item of items) {
        const name = metadata.materialNames[item.key];
        const parts = name.split('_');
        const tier = Number(prefix === 'Artifacts' ? parts.at(-1) : parts[1]);
        const rowName = prefix === 'Artifacts' ? parts.slice(0, -1).join('_') : parts.slice(2).join('_');
        if (tier < 1 || tier > 4) continue;
        matrices.add(item.key);
        const row = rows.get(rowName) ?? {
          name: rowName, colour: metadata.rowColours[rowName] ?? metadata.colours[rowName],
          cells: Array.from({ length: 4 }, () => undefined)
        };
        row.cells[tier - 1] = item;
        rows.set(rowName, row);
      }
      const list = [...rows.values()];
      const chunkSize = prefix === 'Artifacts' ? Math.ceil(list.length / 2) : list.length;
      if (!chunkSize) continue;
      for (let index = 0; index < list.length; index += chunkSize) {
        panels.push({
          title: prefix === 'Artifacts' ? 'ui-artifacts' : prefix === 'BD' ? 'ui-blu-rays' : 'ui-tech-notes',
          columns: ['T1', 'T2', 'T3', 'T4'], rows: list.slice(index, index + chunkSize)
        });
      }
    }
  }
  const keys = new Set([...catalog.map((item) => item.key), ...Object.keys(totals.needed), ...Object.keys(totals.required)]);
  const extra = [...keys].filter((key) => {
    if (matrices.has(key) || ['Eleph', 'ShopResets', 'Spring_Xp', 'Hammer_Xp', 'Barrel_Xp'].includes(key)) return false;
    const item = resourceItem(key, metadata);
    const equipment = item.group === 'Equipment' || key.startsWith('GXP_') || key === 'GearXp' || item.group === 'Weapon items';
    return gear === equipment;
  }).map((key) => resourceItem(key, metadata));
  return { panels, extra };
}
