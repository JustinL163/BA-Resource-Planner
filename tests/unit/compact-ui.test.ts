import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import { cardInvestments, formatInvestment, reorderVisibleCharacters } from '../../src/lib/domain/planner/card-display';
import { inventoryLayout } from '../../src/lib/domain/planner/inventory-layout';
import { createCharacter } from '../../src/lib/domain/planner/defaults';
import { aggregateResources } from '../../src/lib/domain/planner/aggregates';
import { metadata } from '../../.generated-content/planner';
import { decodePlannerDataset } from '../../src/lib/services/planner-data';
import students from '../../planner/json/skillinfo/en.json';
import misc from '../../planner/json/misc_data.json';
import { createLegacyContext } from './legacy-harness';

const dataset = decodePlannerDataset(students, misc, metadata);

describe('compact investment display parity', () => {
  it.each(['Ex', 'Other', 'Gear', 'Book', 'Level', 'BondGear'])('uses the original %s shorthand', (type) => {
    const reference = createLegacyContext(['pageLogic.js'], { type });
    for (const value of [0, 1, 2, 5, 10, 25, 90, '0', '5', '10', undefined]) {
      if (type === 'Book' && value === undefined) continue;
      reference.value = value;
      expect(formatInvestment(type, value)).toBe(runInContext('formatLevel(type, value, true)', reference));
    }
  });

  it('hides identical targets and zero limit-break lines', () => {
    const character = createCharacter(dataset.students['10000'], metadata);
    character.target = { ...character.current };
    const lines = cardInvestments(character);
    expect(lines.find((line) => line.kind === 'skills')).toEqual({ kind: 'skills', current: '1111', target: '' });
    expect(lines.find((line) => line.kind === 'books')).toEqual({ kind: 'books', current: '', target: '' });
  });

  it('uses M and X while omitting bond gear for characters without it', () => {
    const character = createCharacter(dataset.students['10000'], metadata);
    Object.assign(character.target, { ex: 5, basic: 10, passive: 10, sub: 10, gear1: 10, gear2: 10, gear3: 10, book_hp: 25 });
    character.hasBondGear = false;
    const lines = cardInvestments(character);
    expect(lines.find((line) => line.kind === 'skills')?.target).toBe('MMMM');
    expect(lines.find((line) => line.kind === 'gear')?.target).toBe('XXX');
    expect(lines.find((line) => line.kind === 'books')?.target).toBe('25 \u00a00 \u00a00');
  });
});

describe('reordering visible characters', () => {
  it('moves before or after the chosen card without duplicates', () => {
    expect(reorderVisibleCharacters(['a', 'b', 'c'], ['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a']);
    expect(reorderVisibleCharacters(['a', 'b', 'c'], ['a', 'b', 'c'], 'c', 'a', false)).toEqual(['c', 'a', 'b']);
  });

  it('preserves hidden character slots in a filtered view', () => {
    expect(reorderVisibleCharacters(['a', 'hidden', 'b', 'c'], ['a', 'b', 'c'], 'a', 'c', true))
      .toEqual(['b', 'hidden', 'c', 'a']);
  });

  it('uses the displayed sort as the baseline while keeping hidden slots', () => {
    expect(reorderVisibleCharacters(['a', 'hidden', 'b', 'c'], ['c', 'b', 'a'], 'c', 'a', true))
      .toEqual(['b', 'hidden', 'a', 'c']);
  });

  it('rejects a stale drag snapshot instead of silently losing a character', () => {
    expect(() => reorderVisibleCharacters(['a', 'c'], ['a', 'b', 'c'], 'a', 'c', true)).toThrow('ordering changed');
    expect(() => reorderVisibleCharacters(['a', 'c'], ['a', 'c'], 'b', 'c', true)).toThrow('no longer in this view');
  });
});

describe('compact material and equipment matrices', () => {
  const totals = aggregateResources(dataset, [], [], {}, 90);
  it('puts each school/artifact material in exactly one tier cell', () => {
    const { panels } = inventoryLayout(metadata, totals, false);
    const cells = panels.flatMap((panel) => panel.rows.flatMap((row) => row.cells.filter((cell) => cell !== undefined)));
    const expected = Object.keys(metadata.materialNames).filter((id) => Number(id) < 1000 || (Number(id) >= 3000 && Number(id) < 5000));
    expect(cells.map((cell) => cell.key).sort()).toEqual(expected.sort());
    expect(panels.every((panel) => panel.columns.length === 4)).toBe(true);
    expect(panels.flatMap((panel) => panel.rows).every((row) => row.cells.length === 4)).toBe(true);
  });

  it('separates gear and materials, with all equipment tiers and XP items retained', () => {
    const gear = inventoryLayout(metadata, totals, true);
    expect(gear.panels.flatMap((panel) => panel.rows.flatMap((row) => row.cells.map((item) => item?.key))).sort())
      .toEqual([...metadata.equipment].sort());
    expect(gear.extra.some((item) => item.key === 'GXP_4')).toBe(true);
    expect(gear.extra.some((item) => item.key === 'T4_Needle')).toBe(true);
    const resources = inventoryLayout(metadata, totals, false);
    expect(resources.extra.some((item) => item.key === 'XP_4')).toBe(true);
    expect(resources.extra.some((item) => item.key === 'GXP_4')).toBe(false);
    expect(gear.extra.some((item) => item.key === 'Credit')).toBe(false);
  });
});
