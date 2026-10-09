export type SearchAliases = Record<string, Record<string, string[]>>;
export interface StudentSearchEntry { id: string; terms: string[] }
export type StudentSearchIndex = StudentSearchEntry[];

export function decodeSearchAliases(value: unknown): SearchAliases {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Search aliases must be an object.');
  const aliases: SearchAliases = Object.create(null);
  for (const [id, languages] of Object.entries(value)) {
    if (typeof languages !== 'object' || languages === null || Array.isArray(languages)) {
      throw new Error(`Invalid search aliases for ${id}.`);
    }
    const entry: Record<string, string[]> = Object.create(null);
    for (const [language, names] of Object.entries(languages)) {
      if (!Array.isArray(names) || !names.every((name: unknown) => typeof name === 'string' && name.trim().length > 0)) {
        throw new Error(`Search aliases for ${id}/${language} must be non-empty strings.`);
      }
      entry[language.toUpperCase()] = names;
    }
    aliases[id] = entry;
  }
  return aliases;
}

export function createStudentSearchIndex(
  students: Record<string, { Name: string }>, names: Record<string, string> = {},
  manualAliases: unknown = {}, language = 'EN'
): StudentSearchIndex {
  const aliases = decodeSearchAliases(manualAliases);
  return Object.entries(students).map(([id, info]) => {
    const manual = aliases[id];
    const terms = [
      info.Name, names[id] ?? info.Name,
      ...(manual?.EN ?? []), ...(language.toUpperCase() === 'EN' ? [] : manual?.[language.toUpperCase()] ?? [])
    ];
    return { id, terms: [...new Set(terms.map((term) => term.toLowerCase().trim()))] };
  });
}

export function stringSimilarity(first: string, second: string, gramSize = 2): number {
  if (!first.length || !second.length) return 0;
  if (!Number.isInteger(gramSize) || gramSize < 1) throw new Error('Gram size must be a positive integer.');
  const grams = (text: string) => {
    const padded = ' '.repeat(gramSize - 1) + text.toLowerCase() + ' '.repeat(gramSize - 1);
    return Array.from({ length: padded.length - gramSize + 1 }, (_value, index) => padded.slice(index, index + gramSize));
  };
  const shorter = first.length < second.length ? first : second;
  const longer = first.length < second.length ? second : first;
  const available = new Set(grams(shorter));
  const comparison = grams(longer);
  let hits = 0;
  for (const gram of comparison) if (available.delete(gram)) hits++;
  return hits / comparison.length;
}

export function searchStudents(
  index: StudentSearchIndex, input: string, allowed?: ReadonlySet<string>, limit = 5
): string[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Search result limit must be a positive integer.');
  const query = input.toLowerCase().trim();
  const comparisons = index.filter((entry) => !allowed || allowed.has(entry.id)).flatMap((entry) =>
    entry.terms.map((term) => ({ id: entry.id, term, similarity: stringSimilarity(query, term) }))
  ).sort((first, second) => second.similarity - first.similarity);
  const matches: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => { if (!seen.has(id)) { seen.add(id); matches.push(id); } };
  for (const entry of comparisons) {
    if (entry.similarity > 0.1 && (query.length >= 4 ? entry.term.includes(query) : entry.term.startsWith(query))) add(entry.id);
    if (matches.length >= limit) return matches;
  }
  for (const entry of comparisons) {
    add(entry.id);
    if (matches.length >= limit) break;
  }
  return matches;
}

export function matchesSearchText(index: StudentSearchIndex, id: string, query: string): boolean {
  const text = query.toLowerCase().trim();
  return index.find((entry) => entry.id === id)?.terms.some((term) => term.includes(text)) ?? false;
}
