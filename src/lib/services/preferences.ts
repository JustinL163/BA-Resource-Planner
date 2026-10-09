import { normaliseLanguage, type Language } from '../domain/localisation';

export interface Preferences {
  theme: 'light' | 'dark';
  language: Language;
}

export const defaultPreferences: Preferences = { theme: 'dark', language: 'En' };
const saveKey = 'save-data';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSave(storage: Pick<Storage, 'getItem'>): Record<string, unknown> | null {
  const source = storage.getItem(saveKey);
  if (source === null) return null;
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) {
    throw new Error('The saved planner data is not an object.');
  }
  return value;
}

export function readPreferences(storage: Pick<Storage, 'getItem'>): Preferences {
  const data = readSave(storage);
  return {
    theme: data?.page_theme === 'light' ? 'light' : 'dark',
    language: normaliseLanguage(data?.language)
  };
}

export function createDefaultSave(): Record<string, unknown> {
  return {
    exportVersion: 2,
    characters: [],
    character_order: [],
    disabled_characters: [],
    owned_materials: {},
    groups: {
      Binah: [], Chesed: [], Hod: [], ShiroKuro: [],
      Perorodzilla: [], Goz: [], Hieronymous: [], Kaiten: []
    },
    language: 'EN',
    level_cap: 90
  };
}

export function writePreferences(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  patch: Partial<Preferences>
): Preferences {
  const data = readSave(storage) ?? createDefaultSave();
  if (patch.theme !== undefined) data.page_theme = patch.theme;
  if (patch.language !== undefined) data.language = patch.language;
  storage.setItem(saveKey, JSON.stringify(data));
  return readPreferences(storage);
}
