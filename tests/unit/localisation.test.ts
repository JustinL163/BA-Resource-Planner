import { describe, expect, it } from 'vitest';
import { runInContext } from 'node:vm';
import {
  getLanguageString, getTranslationStrings, languageOptions, type TranslationStrings
} from '../../src/lib/domain/localisation';
import strings from '../../planner/json/strings.json';
import { createLegacyContext, evaluate } from './legacy-harness';

describe('localisation parity', () => {
  it.each(languageOptions)('matches every existing string in $value', ({ value }) => {
    const context = createLegacyContext(['config.js', 'common.js'], { language_strings: strings, selectedLanguage: value });
    runInContext('language = selectedLanguage;', context);
    for (const id of Object.keys(strings)) {
      context.stringId = id;
      expect(getLanguageString(strings, id, value))
        .toBe(evaluate(context, 'GetLanguageString(stringId)'));
    }
  });

  it('retains English fallback and the missing-key diagnostic', () => {
    const sample: TranslationStrings = { label: { EN: 'English', KR: '' } };
    expect(getLanguageString(sample, 'label', 'Kr')).toBe('English');
    expect(getLanguageString(sample, 'missing', 'En')).toBe('Undefined');
  });

  it.each(['KR', 'JP', 'TW', 'CN', 'TH', 'ID'])('matches translated and untranslated exports for %s', (language) => {
    for (const translated of [false, true]) {
      const context = createLegacyContext(['debugPage.js'], { selectedLanguage: language, translated, strings });
      runInContext('language_strings = strings; GetTranslationStrings(selectedLanguage, translated);', context);
      const source = runInContext("document.getElementById('text-body').innerText", context);
      expect(getTranslationStrings(strings, language, translated)).toEqual(JSON.parse(source));
    }
  });
});
