import { isRecord } from './save';
import type { CharacterInfo, PlannerCharacter } from './types';
import { formatInvestment } from './card-display';

export type TeamSlot = string | ({ id: string } & Record<string, unknown>) | null;
export type Team = [TeamSlot, TeamSlot, TeamSlot, TeamSlot, TeamSlot, TeamSlot];
export interface SlotLocation { team: number; slot: number }
export const emptyTeam = (): Team => [null, null, null, null, null, null];
export const slotId = (slot: TeamSlot): string => slot === null ? '' : typeof slot === 'string' ? slot : slot.id;
export const isBorrowed = (slot: TeamSlot): boolean => slot !== null && typeof slot === 'object';
export const groupFingerprint = (value: unknown): string => JSON.stringify(value) ?? 'undefined';

export function readTeams(value: unknown): Team[] {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error('This group has an unsupported format. Other groups and saved data have not been changed.');
  return value.map((entry: unknown) => {
    if (!Array.isArray(entry) || entry.length > 6) throw new Error('A team must contain at most six slots.');
    const team = emptyTeam();
    for (let index = 0; index < entry.length; index++) {
      const slot: unknown = entry[index];
      if (slot === null) team[index] = null;
      else if (typeof slot === 'string' || typeof slot === 'number') team[index] = String(slot);
      else if (isRecord(slot) && (typeof slot.id === 'string' || typeof slot.id === 'number')) team[index] = { ...slot, id: String(slot.id) };
      else throw new Error(`Invalid team slot ${index + 1}.`);
    }
    return team;
  });
}

export function validateTeams(teams: Team[], students: Record<string, CharacterInfo>): void {
  if (teams.length > 50) throw new Error('A group can contain at most 50 teams.');
  const members = new Set<string>();
  let borrowed = 0;
  for (const team of teams) {
    for (let index = 0; index < team.length; index++) {
      const slot = team[index];
      if (slot === null) continue;
      const id = slotId(slot);
      const info = students[id];
      if (!info) throw new Error(`Student data is missing for team member ${id}.`);
      if (info.SquadType !== (index < 4 ? 'Main' : 'Support')) throw new Error('Strikers and Specials must stay in their respective slots.');
      if (isBorrowed(slot)) borrowed++;
      else if (members.has(id)) throw new Error('A non-borrowed character can only appear once in a group.');
      else members.add(id);
    }
  }
  if (borrowed > 1) throw new Error('Only one borrowed character is allowed per group.');
}

export function memberIds(groups: Record<string, unknown>, selected: string, upTo = false): Set<string> {
  if (!selected) return new Set();
  if (!Object.hasOwn(groups, selected)) throw new Error('The selected group no longer exists.');
  const names = Object.keys(groups);
  const included = upTo ? names.slice(0, names.indexOf(selected) + 1) : [selected];
  return new Set(included.flatMap((name) => readTeams(groups[name])
    .flatMap((team) => team.filter((slot): slot is string => typeof slot === 'string'))));
}

export function checkLocation(teams: Team[], location: SlotLocation): void {
  if (!Number.isInteger(location.team) || location.team < 0 || location.team >= teams.length ||
      !Number.isInteger(location.slot) || location.slot < 0 || location.slot >= 6) {
    throw new Error('This team slot no longer exists. Reopen the picker.');
  }
}

export function nextEmptySlot(teams: Team[], from: SlotLocation): SlotLocation | null {
  const count = teams.length * 6;
  const start = from.team * 6 + from.slot;
  for (let offset = 1; offset <= count; offset++) {
    const index = (start + offset) % count;
    const team = Math.floor(index / 6), slot = index % 6;
    if (teams[team][slot] === null) return { team, slot };
  }
  return null;
}

export function swapSlots(teams: Team[], from: SlotLocation, to: SlotLocation): void {
  checkLocation(teams, from); checkLocation(teams, to);
  if ((from.slot < 4) !== (to.slot < 4)) throw new Error('Only slots with the same role can be swapped.');
  [teams[from.team][from.slot], teams[to.team][to.slot]] = [teams[to.team][to.slot], teams[from.team][from.slot]];
}

export function validateGroupName(groups: Record<string, unknown>, name: string, previous?: string): void {
  if (!name.trim() || name.length > 35) throw new Error('A group name must contain 1-35 characters.');
  if (name !== previous && Object.hasOwn(groups, name)) throw new Error('A group with that name already exists.');
}

export function reorderGroup(groups: Record<string, unknown>, name: string, position: number): Record<string, unknown> {
  const names = Object.keys(groups);
  if (!names.includes(name) || !Number.isInteger(position) || position < 1 || position > names.length) {
    throw new Error('Choose a valid group position.');
  }
  const entries = Object.entries(groups).filter(([key]) => key !== name);
  entries.splice(position - 1, 0, [name, groups[name]]);
  const reordered = Object.fromEntries(entries);
  if (Object.keys(reordered).some((key, index) => key !== entries[index][0])) {
    throw new Error('Numeric group names cannot be moved to that position. Rename them before reordering.');
  }
  return reordered;
}

export function groupText(
  teams: Team[], characters: PlannerCharacter[], names: Record<string, string>, monospaced: boolean
): string {
  const nonEmpty = teams.filter((team) => team.some((slot) => slot !== null));
  const rows = nonEmpty.map((team, index) => ({
    title: `Team ${index + 1}`,
    members: team.filter((slot) => slot !== null).map((slot) => {
      const id = slotId(slot);
      const name = names[id] ?? id;
      if (isBorrowed(slot)) return { name, info: '(Borrowed)' };
      const character = characters.find((item) => item.id === id);
      if (!character) return { name, info: '' };
      const investment = character.current;
      const star = Number(investment.ue) > 0 ? `UE${investment.ue}\u2605` : `${investment.star}\u2605`;
      const skill = [formatInvestment('Ex', investment.ex), ...[investment.basic, investment.passive, investment.sub].map((value) => formatInvestment('Other', value))].join('');
      const gear = [investment.gear1, investment.gear2, investment.gear3].map((value) => formatInvestment('Gear', value)).join('') +
        (character.hasBondGear ? investment.bond_gear : monospaced ? ' ' : '');
      const book = [investment.book_hp, investment.book_atk, investment.book_heal]
        .map((value) => formatInvestment(monospaced ? 'Book' : '', value)).join('/');
      return { name, info: `${star}  ${investment.level}  ${skill}  ${gear}  ${book}  ${Number(investment.ue_level) ? investment.ue_level : ''}` };
    })
  }));
  const longest = Math.max(4, ...rows.flatMap((row) => row.members.map((member) => member.name.length)));
  const heading = monospaced ? 'Name'.padEnd(longest + 1) + 'Star  Lvl Skill Gear LB UE' : 'Name   Star Lvl Skill Gear LB UE';
  return [heading, ...rows.map((row) => `${row.title}\n` +
    row.members.map((member) => (monospaced ? member.name.padEnd(longest + 1) : member.name + ' ') + member.info).join('\n'))].join('\n\n') + '\n';
}
