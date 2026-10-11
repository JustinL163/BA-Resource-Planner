import type { InvestmentValue } from '../resources/types';
import type { PlannerCharacter } from './types';

export type CardMode = 'edit' | 'bulk';

export function formatInvestment(type: string, value: InvestmentValue): string {
  if (type === 'Ex' && Number(value) === 5) return 'M';
  if (type === 'Other' && Number(value) === 10) return 'M';
  if (type === 'Gear' && Number(value) === 10) return 'X';
  if (type === 'Book') return String(value ?? '').padStart(2, '\u00a0');
  return String(value ?? '');
}

export function cardInvestments(character: PlannerCharacter) {
  const line = (side: 'current' | 'target', kind: 'skills' | 'gear' | 'books' | 'level') => {
    const investment = character[side];
    if (kind === 'skills') return [
      formatInvestment('Ex', investment.ex), ...[investment.basic, investment.passive, investment.sub].map((value) => formatInvestment('Other', value))
    ].join('');
    if (kind === 'gear') return [investment.gear1, investment.gear2, investment.gear3]
      .map((value) => formatInvestment('Gear', value)).join('') + (character.hasBondGear ? formatInvestment('BondGear', investment.bond_gear) : '');
    if (kind === 'books') {
      if (['book_hp', 'book_atk', 'book_heal'].every((key) => Number(character.target[key]) === 0)) return '';
      return [investment.book_hp, investment.book_atk, investment.book_heal].map((value) => formatInvestment('Book', value)).join(' ');
    }
    return formatInvestment('Level', investment.level);
  };
  return (['skills', 'gear', 'books', 'level'] as const).map((kind) => {
    const current = line('current', kind);
    const target = line('target', kind);
    return { kind, current, target: current === target ? '' : target };
  });
}

export function reorderVisibleCharacters(
  order: string[], visible: string[], source: string, target: string, after: boolean
): string[] {
  if (!visible.includes(source) || !visible.includes(target)) throw new Error('The dragged character is no longer in this view.');
  if (new Set(visible).size !== visible.length || visible.some((id) => !order.includes(id))) {
    throw new Error('Character ordering changed. Please retry the move.');
  }
  if (source === target) return [...order];
  const reordered = visible.filter((id) => id !== source);
  reordered.splice(reordered.indexOf(target) + Number(after), 0, source);
  const visibleIds = new Set(visible);
  let index = 0;
  return order.map((id) => visibleIds.has(id) ? reordered[index++] : id);
}
