import { checkLocation, emptyTeam, groupFingerprint, readTeams, reorderGroup, swapSlots, validateGroupName, validateTeams, type SlotLocation, type Team } from '../domain/planner/groups';
import type { PlannerDataset, PlannerSave } from '../domain/planner/types';

export type PlannerCommit = (change: (data: PlannerSave, dataset: PlannerDataset) => void) => boolean;
export type GroupCommand =
  | { type: 'create'; name: string }
  | { type: 'rename'; name: string; newName: string; expected: string }
  | { type: 'delete'; name: string; expected: string }
  | { type: 'order'; name: string; position: number; expectedOrder: string };

export function createGroupActions(commit: PlannerCommit) {
  function changeTeams(name: string, expected: string, change: (teams: Team[]) => void) {
    return commit((data, dataset) => {
      if (!Object.hasOwn(data.groups, name) || groupFingerprint(data.groups[name]) !== expected) {
        throw new Error('This group changed in another window. Refresh the group before saving.');
      }
      const teams = readTeams(data.groups[name]);
      if (!teams.length) teams.push(emptyTeam());
      change(teams);
      validateTeams(teams, dataset.students);
      data.groups = { ...data.groups, [name]: teams.length ? teams : null };
    });
  }
  return {
    group(command: GroupCommand) {
      return commit((data) => {
        if (command.type === 'create') {
          validateGroupName(data.groups, command.name);
          data.groups = { ...data.groups, [command.name]: null };
        } else if (command.type === 'order') {
          if (JSON.stringify(Object.keys(data.groups)) !== command.expectedOrder) {
            throw new Error('Group ordering changed in another window. Please retry.');
          }
          data.groups = reorderGroup(data.groups, command.name, command.position);
        } else {
          if (!Object.hasOwn(data.groups, command.name) || groupFingerprint(data.groups[command.name]) !== command.expected) {
            throw new Error('This group changed in another window. Refresh the group before saving.');
          }
          if (command.type === 'rename') validateGroupName(data.groups, command.newName, command.name);
          data.groups = Object.fromEntries(Object.entries(data.groups).flatMap(([name, value]) =>
            name !== command.name ? [[name, value]] : command.type === 'rename' ? [[command.newName, value]] : []));
        }
      });
    },
    teamSlot(name: string, expected: string, location: SlotLocation, id: string | null, borrowed = false) {
      return changeTeams(name, expected, (teams) => {
        checkLocation(teams, location);
        const previous = teams[location.team][location.slot];
        teams[location.team][location.slot] = id === null ? null : borrowed ? {
          ...(previous !== null && typeof previous === 'object' && previous.id === id ? previous : {}), id
        } : id;
      });
    },
    swapTeamSlots(name: string, expected: string, from: SlotLocation, to: SlotLocation) {
      return changeTeams(name, expected, (teams) => swapSlots(teams, from, to));
    },
    addTeam(name: string, expected: string) {
      return changeTeams(name, expected, (teams) => { teams.push(emptyTeam()); });
    },
    removeTeam(name: string, expected: string, index: number) {
      return changeTeams(name, expected, (teams) => {
        checkLocation(teams, { team: index, slot: 0 });
        teams.splice(index, 1);
      });
    },
    moveTeam(name: string, expected: string, index: number, direction: -1 | 1) {
      return changeTeams(name, expected, (teams) => {
        checkLocation(teams, { team: index, slot: 0 });
        const destination = index + direction;
        checkLocation(teams, { team: destination, slot: 0 });
        [teams[index], teams[destination]] = [teams[destination], teams[index]];
      });
    },
    moveTeamTo(name: string, expected: string, source: number, target: number) {
      return changeTeams(name, expected, (teams) => {
        checkLocation(teams, { team: source, slot: 0 });
        checkLocation(teams, { team: target, slot: 0 });
        const [team] = teams.splice(source, 1);
        if (!team) throw new Error('This team no longer exists. Refresh the group before saving.');
        teams.splice(target, 0, team);
      });
    }
  };
}
