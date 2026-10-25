import { describe, expect, it } from 'vitest';
import data from '../../game/guesser/data.json';
import {
  allowedAnswer, answerFor, calculateScore, createChoices, createQuestionPool, cyrb53, evaluateAnswer,
  formatTime, imageFor, recordHash, recordIsValid, scoreTitle, type GuesserData, type GuesserQuestion,
  type GuesserSettings
} from '../../src/lib/domain/guesser';
import {
  legacyQuestionCounts, legacyRecordHash, legacyScoreVectors
} from '../fixtures/guesser.legacy.js';

const settings = (patch: Partial<GuesserSettings> = {}): GuesserSettings => ({
  category: 'Halos', input: 'Freeform', timeLimit: null, maxGuesses: 1, colour: 'Colour', lenience: 3,
  dateMode: 'Date', conscious: 'Sleeping', ...patch
});

const sampleData: GuesserData = {
  halos: {
    '1': { name: 'Akari', released: true, altnames: ['Ari'], weapons: [11], alts: [101, 102], chocolate: true, surname: 'Wanibuchi', age: 16, birthday: 'December 9', height: 167 },
    '2': { name: 'Juri', released: true, weapons: [12], alts: [201], chocolate: false, surname: 'Ushimaki', age: 15, birthday: 'March 30', height: 163 },
    '3': { name: 'Unreleased', altnames: ['Hidden'], weapons: [13, 14], alts: [301], chocolate: true, surname: 'Secret', age: 18, birthday: 'January 1', height: 170 }
  }
};

describe('guessing game compatibility', () => {
  it('builds each category pool using the same released and alternate-appearance rules', () => {
    expect(createQuestionPool(sampleData, 'Halos').map(({ id }) => id)).toEqual(['1', '2']);
    expect(createQuestionPool(sampleData, 'Weapons').map(({ weapon }) => weapon)).toEqual([11, 12, 13, 14]);
    expect(createQuestionPool(sampleData, 'Chocolates').map(({ id }) => id)).toEqual(['1', '3']);
    expect(createQuestionPool(sampleData, 'Silhouettes').map(({ alt }) => alt)).toEqual([101, 102, 201, 301]);
    for (const category of ['Surnames', 'Ages', 'Birthdays', 'Heights'] as const) {
      expect(createQuestionPool(sampleData, category).map(({ id }) => id)).toEqual(['1', '2']);
    }
  });

  it('matches the legacy dataset question counts across all eight categories', () => {
    for (const [category, count] of Object.entries(legacyQuestionCounts) as Array<[keyof typeof legacyQuestionCounts, number]>) {
      expect(createQuestionPool(data as GuesserData, category)).toHaveLength(count);
    }
  });

  it('retains aliases, date validation, height lenience, and the legacy height entry range', () => {
    const akari = createQuestionPool(sampleData, 'Halos')[0];
    expect(allowedAnswer('ARI', [akari], settings())).toBe(true);
    expect(evaluateAnswer(akari, 'Ari', settings())).toBe('correct');

    const birthday = createQuestionPool(sampleData, 'Birthdays')[1];
    const dateSettings = settings({ category: 'Birthdays' });
    expect(allowedAnswer('mar 30', [birthday], dateSettings)).toBe(true);
    expect(allowedAnswer('mar 32', [birthday], dateSettings)).toBe(false);
    expect(evaluateAnswer(birthday, 'MAR 30', dateSettings)).toBe('correct');
    expect(answerFor(birthday, settings({ category: 'Birthdays', dateMode: 'Month' }))).toBe('March');

    const height = createQuestionPool(sampleData, 'Heights')[0];
    const heightSettings = settings({ category: 'Heights', lenience: 1 });
    expect(evaluateAnswer(height, '168', heightSettings)).toBe('half-correct');
    expect(evaluateAnswer(height, '167', heightSettings)).toBe('correct');
    expect(allowedAnswer('180', createQuestionPool(sampleData, 'Heights'), settings({ category: 'Heights' }))).toBe(false);
  });

  it('creates unique multiple-choice answers and preserves legacy image URLs', () => {
    const questions = createQuestionPool(sampleData, 'Halos');
    const choices = createChoices(questions[0], questions, settings(), () => 0.75);
    expect(choices).toHaveLength(2);
    expect(new Set(choices).size).toBe(2);
    expect(choices).toContain('Akari');
    expect(imageFor({ ...questions[0], weapon: 11 }, settings({ category: 'Weapons' })))
      .toBe('/planner/icons/UE/weapon_icon_11.webp');
    expect(imageFor({ ...questions[0], alt: 101 }, settings({ category: 'Silhouettes', conscious: 'Sleeping' })))
      .toBe('/game/sleeping/101.webp');
    expect(imageFor({ ...questions[0], alt: 101 }, settings({ category: 'Silhouettes', conscious: 'Awake' })))
      .toBe('/planner/icons/splashart/101.webp');
  });

  it('matches independent legacy scoring, record hashes, and result formatting vectors', () => {
    for (const vector of legacyScoreVectors) {
      expect(calculateScore(vector.correct, vector.questions, vector.elapsed, vector.settings as GuesserSettings)).toBe(vector.score);
    }
    expect(recordHash(legacyRecordHash.record)).toBe(legacyRecordHash.hash);
    expect(cyrb53('hello')).toBe(4625896200565286);
    expect(recordIsValid({ ...legacyRecordHash.record, string: legacyRecordHash.hash })).toBe(true);
    expect(recordIsValid({ ...legacyRecordHash.record, string: 1 })).toBe(false);
    expect(formatTime(65.12)).toBe('1:05.12');
    expect(scoreTitle(settings({ category: 'Birthdays', dateMode: 'Date', input: 'MultiChoice', timeLimit: 1.5 })))
      .toBe('Birthdays M 1.5s D');
  });
});
