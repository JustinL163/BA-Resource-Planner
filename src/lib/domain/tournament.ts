export const tournamentOptions = [
  ['tournament-7', 'S7 Wakamo']
] as const;
const tournamentLabels: Record<string, string> = {
  'tournament-1': 'S2 ShiroKuro', 'tournament-2': 'S3 Kaiten', 'tournament-3': 'S4 Hod',
  'tournament-5': 'S5 Goz', 'tournament-6': 'S6 Goz', 'tournament-7': 'S7 Wakamo'
};

export const tournamentStages = [
  ['qualifiers', 'Qualifiers'], ['groups', 'Groups'], ['elimination', 'Elimination']
] as const;
export const tournamentGames = [
  ['game-1', '1'], ['game-2', '2'], ['game-3', '3'], ['game-4', '4']
] as const;
export const tournamentArmours = [
  ['light', 'Light'], ['heavy', 'Heavy'], ['special', 'Special'], ['elastic', 'Elastic']
] as const;

export type TournamentSlot = string | [string] | null;
export type TournamentTeam = TournamentSlot[];

export interface TournamentRecord extends Record<string, unknown> {
  Tournament: string;
  Stage: string;
  Game: string;
  Player1: string;
  Player2: string;
  Armour: string;
  ForcePick: TournamentSlot;
  Player1Bans: string[];
  Player2Bans: string[];
  Player1Teams: TournamentTeam[];
  Player2Teams: TournamentTeam[];
  Player1Score: string | number;
  Player2Score: string | number;
}

export interface TournamentSelection {
  Tournament: string;
  Stage: string;
  Game: string;
  Player1: string;
  Player2: string;
  Armour: string;
}

export interface TournamentForm extends TournamentSelection {
  Player1Score: string;
  Player2Score: string;
  ForcePick: string | null;
  Player1Bans: (string | null)[];
  Player2Bans: (string | null)[];
  Player1Teams: TournamentTeam[];
  Player2Teams: TournamentTeam[];
}

export const emptyTournamentTeam = (): TournamentTeam => [null, null, null, null, null, null];

export function createTournamentForm(): TournamentForm {
  return {
    Tournament: 'tournament-7', Stage: 'qualifiers', Game: 'game-1', Player1: 'n/a', Player2: 'n/a', Armour: 'light',
    Player1Score: '', Player2Score: '', ForcePick: null,
    Player1Bans: Array.from({ length: 5 }, () => null), Player2Bans: Array.from({ length: 5 }, () => null),
    Player1Teams: [emptyTournamentTeam()], Player2Teams: [emptyTournamentTeam()]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeRecord(value: unknown, index: number): TournamentRecord {
  let decoded = value;
  if (typeof value === 'string') {
    try { decoded = JSON.parse(value); }
    catch { throw new Error(`Tournament record ${index + 1} is invalid JSON.`); }
  }
  if (!isRecord(decoded)) throw new Error(`Tournament record ${index + 1} has an invalid format.`);
  return decoded as TournamentRecord;
}

export function decodeTournamentRecords(value: unknown): TournamentRecord[] {
  if (!isRecord(value) || !Object.hasOwn(value, 'Data')) throw new Error('Tournament data has an invalid format.');
  let records: unknown = value.Data;
  if (typeof records === 'string') {
    try { records = JSON.parse(records); }
    catch { throw new Error('Tournament records could not be decoded.'); }
  }
  if (!Array.isArray(records)) throw new Error('Tournament records have an invalid format.');
  return records.map(decodeRecord);
}

function keyMatches(record: TournamentRecord, selection: TournamentSelection): boolean {
  if (record.Tournament !== selection.Tournament || record.Stage !== selection.Stage ||
      record.Game !== selection.Game || record.Armour !== selection.Armour) return false;
  return (record.Player1 === selection.Player1 && record.Player2 === selection.Player2) ||
    (record.Player1 === selection.Player2 && record.Player2 === selection.Player1);
}

export function findTournamentRecord(
  records: TournamentRecord[], selection: TournamentSelection
): TournamentRecord | null {
  return records.find((record) => keyMatches(record, selection)) ?? null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function studentId(value: unknown): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

function teamValue(value: unknown): TournamentTeam[] {
  if (!Array.isArray(value) || value.length === 0) return [emptyTournamentTeam()];
  return value.map((raw) => {
    if (!Array.isArray(raw)) return emptyTournamentTeam();
    return Array.from({ length: 6 }, (_unused, index) => {
      const slot = raw[index];
      if (Array.isArray(slot)) {
        const id = studentId(slot);
        return id === null ? null : [id];
      }
      return studentId(slot);
    });
  });
}

export function tournamentFormFromRecord(record: TournamentRecord): TournamentForm {
  const form = createTournamentForm();
  return {
    ...form,
    Tournament: stringValue(record.Tournament) || form.Tournament,
    Stage: stringValue(record.Stage) || form.Stage,
    Game: stringValue(record.Game) || form.Game,
    Player1: stringValue(record.Player1) || form.Player1,
    Player2: stringValue(record.Player2) || form.Player2,
    Armour: stringValue(record.Armour) || form.Armour,
    Player1Score: stringValue(record.Player1Score),
    Player2Score: stringValue(record.Player2Score),
    ForcePick: studentId(record.ForcePick),
    Player1Bans: Array.from({ length: 5 }, (_unused, index) => studentId(record.Player1Bans?.[index])),
    Player2Bans: Array.from({ length: 5 }, (_unused, index) => studentId(record.Player2Bans?.[index])),
    Player1Teams: teamValue(record.Player1Teams),
    Player2Teams: teamValue(record.Player2Teams)
  };
}

export function validateTournamentSubmission(form: TournamentForm): string | null {
  if (form.Player1 === 'n/a') return "Player 1 can't be empty";
  if (form.Player1 === form.Player2) return "Both players can't be the same";
  if (!form.ForcePick) return 'Force pick needs to be set';
  return null;
}

export function updateTournamentRecords(
  records: TournamentRecord[], submission: TournamentRecord
): TournamentRecord[] {
  const index = records.findIndex((record) => keyMatches(record, submission));
  if (index < 0) return [...records, submission];
  return records.map((record, position) => position === index ? submission : record);
}

function named(id: string | null, names: Record<string, string>): string {
  return id === null ? '' : names[id] ?? id;
}

function namedSlot(value: unknown, names: Record<string, string>): string | null {
  return named(studentId(value), names) || null;
}

function namedBans(value: unknown, names: Record<string, string>): string[] | false {
  if (!Array.isArray(value)) return false;
  const result = value.map((entry) => named(studentId(entry), names)).filter(Boolean);
  return result.length ? result : false;
}

function namedTeams(value: unknown, names: Record<string, string>): (string | null)[][] | false {
  if (!Array.isArray(value)) return false;
  let allNull = true;
  const teams = value.filter((team): team is unknown[] => Array.isArray(team)).map((team) =>
    team.map((slot) => {
      const label = namedSlot(slot, names);
      if (label) allNull = false;
      return label;
    })
  );
  return allNull ? false : teams;
}

function arrayCsvValue(value: string[] | (string | null)[][] | false): string {
  return value ? `"${JSON.stringify(value).replaceAll('"', '')}"` : '';
}

export function exportTournamentCsv(records: TournamentRecord[], names: Record<string, string>): string {
  const stageLabels = Object.fromEntries(tournamentStages);
  const gameLabels = Object.fromEntries(tournamentGames);
  const armourLabels = Object.fromEntries(tournamentArmours);
  const lines = ['Tournament,Stage,Player1,Player2,Game,Armour,ForcePick,Player1Bans,Player2Bans,Player1Teams,Player2Teams,Player1Score,Player2Score'];
  for (const record of records) {
    const player2 = record.Player2 === 'n/a' ? '' : stringValue(record.Player2);
    const row = [
      tournamentLabels[stringValue(record.Tournament)] ?? stringValue(record.Tournament),
      stageLabels[stringValue(record.Stage)] ?? stringValue(record.Stage),
      stringValue(record.Player1), player2,
      gameLabels[stringValue(record.Game)] ?? stringValue(record.Game),
      armourLabels[stringValue(record.Armour)] ?? stringValue(record.Armour),
      named(studentId(record.ForcePick), names),
      arrayCsvValue(namedBans(record.Player1Bans, names)),
      arrayCsvValue(namedBans(record.Player2Bans, names)),
      arrayCsvValue(namedTeams(record.Player1Teams, names)),
      arrayCsvValue(namedTeams(record.Player2Teams, names)),
      stringValue(record.Player1Score), stringValue(record.Player2Score)
    ];
    lines.push(row.join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
