export type TranslateLabel = (id: string) => string;

function translatedOrFallback(translate: TranslateLabel, key: string, fallback: string): string {
  const value = translate(key);
  return value === 'Undefined' ? fallback : value;
}

export function localizedSchoolName(name: string, translate: TranslateLabel): string {
  return translatedOrFallback(translate, `school-${name.toLowerCase()}`, name);
}

const attackTypeKeys: Record<string, string> = {
  Explosion: 'atktype-explosion',
  Pierce: 'atktype-pierce',
  Mystic: 'atktype-mystic',
  Sonic: 'atktype-sonic'
};

export function localizedAttackTypeName(name: string, translate: TranslateLabel): string {
  return translatedOrFallback(translate, attackTypeKeys[name] ?? `atktype-${name.toLowerCase()}`, name);
}

export function localizedDefenseTypeName(name: string, translate: TranslateLabel): string {
  return translatedOrFallback(translate, `deftype-${name.toLowerCase()}`, name);
}
