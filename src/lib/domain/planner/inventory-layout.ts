import { inventoryCatalog, resourceItem, type ResourceItem } from './catalog';
import type { PlannerMetadata, ResourceTotals } from './types';

export interface MaterialRow { name: string; colour?: string; cells: (ResourceItem | undefined)[] }
export interface MaterialPanel {
  title: string; columns: string[]; rows: MaterialRow[];
  columnGroups?: { title: string; colspan: number }[];
}

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
    const schoolRows = new Map<string, MaterialRow>();
    for (const prefix of ['BD', 'TN']) {
      const items = catalog.filter((item) => metadata.materialNames[item.key]?.startsWith(`${prefix}_`));
      for (const item of items) {
        const parts = metadata.materialNames[item.key].split('_');
        const tier = Number(parts[1]);
        const rowName = parts.slice(2).join('_');
        if (tier < 1 || tier > 4) continue;
        matrices.add(item.key);
        const row = schoolRows.get(rowName) ?? {
          name: rowName, colour: metadata.rowColours[rowName] ?? metadata.colours[rowName],
          cells: Array.from({ length: 8 }, () => undefined)
        };
        row.cells[(prefix === 'BD' ? 0 : 4) + tier - 1] = item;
        schoolRows.set(rowName, row);
      }
    }
    if (schoolRows.size) {
      panels.push({
        title: 'ui-blu-rays',
        columns: ['T1', 'T2', 'T3', 'T4', 'T1', 'T2', 'T3', 'T4'],
        columnGroups: [{ title: 'ui-blu-rays', colspan: 4 }, { title: 'ui-tech-notes', colspan: 4 }],
        rows: [...schoolRows.values()]
      });
    }

    const artifactRows = new Map<string, MaterialRow>();
    const artifactItems = catalog.filter((item) => item.group === 'Artifacts');
    for (const item of artifactItems) {
      const parts = metadata.materialNames[item.key].split('_');
      const tier = Number(parts.at(-1));
      const rowName = parts.slice(0, -1).join('_');
      if (tier < 1 || tier > 4) continue;
      matrices.add(item.key);
      const row = artifactRows.get(rowName) ?? {
        name: rowName, colour: metadata.rowColours[rowName] ?? metadata.colours[rowName],
        cells: Array.from({ length: 4 }, () => undefined)
      };
      row.cells[tier - 1] = item;
      artifactRows.set(rowName, row);
    }
    const artifactList = [...artifactRows.values()];
    const artifactChunkSize = Math.ceil(artifactList.length / 2);
    for (let index = 0; index < artifactList.length; index += artifactChunkSize) {
      panels.push({
        title: 'ui-artifacts', columns: ['T1', 'T2', 'T3', 'T4'],
        rows: artifactList.slice(index, index + artifactChunkSize)
      });
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
