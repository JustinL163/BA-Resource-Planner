import { resourceItem } from '../domain/planner/catalog';
import type { PlannerMetadata } from '../domain/planner/types';
import type { EventReward, StandardEvent } from '../domain/events/standard-types';

export function eventItem(reward: EventReward, event: StandardEvent, metadata: PlannerMetadata, names: Record<string, string>) {
  const id = String(reward.id);
  if (event.currencies[id]) return { name: event.currencies[id].shortname, image: `/planner/icons/EventIcon/CurrencyIcon/${event.currencies[id].icon}` };
  if (id === '1') return { name: 'Credit', image: '/planner/icons/Misc/Credit.png' };
  if (id === '23') return { name: 'Eligma', image: '/planner/icons/Misc/Eligma.png' };
  const materialId = Object.keys(metadata.materialNames).find((key) => metadata.materialNames[key] === id) ?? id;
  const resource = resourceItem(materialId, metadata);
  if (Number(id) >= 10000 && Number(id) < 30000) return { name: `${names[id] ?? id} Eleph`, image: `/planner/icons/Eleph/Eleph_${id}.webp` };
  if (id.includes('Credit')) return { name: id.replace('-', ' '), image: '/planner/icons/Misc/Credit.png' };
  if (id.includes('Eligma')) return { name: id.replace('-', ' '), image: '/planner/icons/Misc/Eligma.png' };
  if (reward.type === 'Pyroxene' || id === 'Pyroxene' || id.startsWith('Pyroxene-')) {
    return { name: 'Pyroxene', image: '/planner/icons/Misc/Pyroxene.png' };
  }
  if (resource.image) return resource;
  if (reward.type === 'Gift' || reward.type === 'Furniture') {
    const folder = reward.type === 'Gift' ? 'Gifts' : 'Furniture';
    return { name: resource.name, image: `/planner/icons/${folder}/${encodeURIComponent(id)}.png` };
  }
  if (id === 'SecretTech') return { name: 'Secret Tech', image: '/planner/icons/Misc/SecretTech.png' };
  if (reward.type === 'Misc') {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid miscellaneous reward image.');
    if (id === '1-Recruitment_Ticket') return { name: 'Recruitment Ticket' };
    return { name: resource.name, image: `/planner/icons/MiscItem/${id}.png` };
  }
  if (id === 'GearBox' || id === 'Random_Equipment_Box_0') return { name: 'Random Equipment Box', image: '/planner/icons/MiscItem/Random_Equipment_Box_0.png' };
  return { name: resource.name };
}
