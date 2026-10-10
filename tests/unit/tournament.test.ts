import { describe, expect, it } from 'vitest';
import {
  createTournamentForm, decodeTournamentRecords, exportTournamentCsv, findTournamentRecord,
  tournamentFormFromRecord, updateTournamentRecords, validateTournamentSubmission,
  type TournamentRecord, type TournamentSelection
} from '../../src/lib/domain/tournament';

function record(overrides: Partial<TournamentRecord> = {}): TournamentRecord {
  return {
    Tournament: 'tournament-7', Stage: 'qualifiers', Game: 'game-1', Player1: 'Wiggle', Player2: 'airu', Armour: 'light',
    ForcePick: '10000', Player1Bans: ['10001'], Player2Bans: [],
    Player1Teams: [['10000', null, null, null, ['10001'], null]],
    Player2Teams: [[null, null, null, null, null, null]], Player1Score: '2', Player2Score: '1',
    ...overrides
  };
}

describe('tournament records', () => {
  it('decodes the API double-encoded record list and retains unknown record fields', () => {
    const source = record({ UpdatedBy: 'official-import' });
    expect(decodeTournamentRecords({ Data: JSON.stringify([JSON.stringify(source)]) })).toEqual([source]);
  });

  it('rejects malformed data instead of presenting it as an empty tournament', () => {
    expect(() => decodeTournamentRecords({ Data: '{broken' })).toThrow('could not be decoded');
    expect(() => decodeTournamentRecords({ Data: JSON.stringify([null]) })).toThrow('invalid format');
  });

  it('finds a match when the selected players are in either order', () => {
    const saved = record();
    const selected: TournamentSelection = {
      Tournament: 'tournament-7', Stage: 'qualifiers', Game: 'game-1', Player1: 'airu', Player2: 'Wiggle', Armour: 'light'
    };
    expect(findTournamentRecord([saved], selected)).toBe(saved);
  });

  it('restores six slots, borrowed markers, bans, scores and saved player ordering', () => {
    const form = tournamentFormFromRecord(record());
    expect(form.Player1).toBe('Wiggle');
    expect(form.Player1Teams[0]).toEqual(['10000', null, null, null, ['10001'], null]);
    expect(form.Player1Bans).toEqual(['10001', null, null, null, null]);
    expect(form.Player2Bans).toEqual([null, null, null, null, null]);
    expect(form.Player1Score).toBe('2');
    expect(form.Player2Score).toBe('1');
  });

  it('validates only the legacy required save fields', () => {
    const form = createTournamentForm();
    expect(validateTournamentSubmission(form)).toBe("Player 1 can't be empty");
    form.Player1 = 'Wiggle';
    form.Player2 = 'Wiggle';
    expect(validateTournamentSubmission(form)).toBe("Both players can't be the same");
    form.Player2 = 'n/a';
    expect(validateTournamentSubmission(form)).toBe('Force pick needs to be set');
    form.ForcePick = '10000';
    expect(validateTournamentSubmission(form)).toBeNull();
  });

  it('replaces a matching entry regardless of player order and appends new matches', () => {
    const saved = record();
    const updated = record({ Player1: 'airu', Player2: 'Wiggle', Player1Score: '3' });
    expect(updateTournamentRecords([saved], updated)).toEqual([updated]);
    expect(updateTournamentRecords([], updated)).toEqual([updated]);
  });

  it('exports the fixed CSV columns with English labels and legacy team encoding', () => {
    const csv = exportTournamentCsv([record()], { '10000': 'Aru', '10001': 'Hifumi' });
    expect(csv).toBe([
      'Tournament,Stage,Player1,Player2,Game,Armour,ForcePick,Player1Bans,Player2Bans,Player1Teams,Player2Teams,Player1Score,Player2Score',
      'S7 Wakamo,Qualifiers,Wiggle,airu,1,Light,Aru,"[Hifumi]",,"[[Aru,null,null,null,Hifumi,null]]",,2,1',
      ''
    ].join('\r\n'));
  });
});
