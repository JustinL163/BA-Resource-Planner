export const languageOptions = [
  { value: 'En', label: 'English' },
  { value: 'Kr', label: '\uD55C\uAD6D\uC5B4' },
  { value: 'Jp', label: '\u65E5\u672C\u8A9E' },
  { value: 'Tw', label: '\u7E41\u9AD4\u4E2D\u6587' },
  { value: 'Cn', label: '\u7B80\u4F53\u4E2D\u6587(\u793E\u533A)' },
  { value: 'Th', label: '\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22' },
  { value: 'Id', label: 'Indonesian' }
] as const;

export type Language = (typeof languageOptions)[number]['value'];
export type TranslationStrings = Record<string, Record<string, string>>;

export function normaliseLanguage(value: unknown): Language {
  // Older saves used CN for Traditional Chinese; the newer selector uses Cn for Simplified.
  if (value === 'CN') return 'Tw';
  return languageOptions.find((option) =>
    typeof value === 'string' && option.value.toLowerCase() === value.toLowerCase()
  )?.value ?? 'En';
}

export function getLanguageString(strings: TranslationStrings, id: string, language: Language): string {
  const entry = strings[id];
  return entry ? entry[language.toUpperCase()] || entry.EN : 'Undefined';
}

export function getTranslationStrings(
  strings: TranslationStrings,
  language: string,
  translated: boolean
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const [id, entry] of Object.entries(strings)) {
    if (translated && entry[language] !== undefined) {
      result[id] = { EN: entry.EN, [language]: entry[language] };
    } else if (!translated && entry[language] === undefined) {
      result[id] = { EN: entry.EN, [language]: '' };
    }
  }
  return result;
}
