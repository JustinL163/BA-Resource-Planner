import type { StudentInfo } from '../resources/types';
import type { PlannerMetadata } from './types';

export interface ExMaterialFilterOption {
  key: string;
  label: string;
}

type MaterialMetadata = Pick<PlannerMetadata, 'materialNames'>;

/** Convert a legacy material category name into the key used by planner filters. */
export function exMaterialFilterKey(category: string): string {
  return category.toLowerCase().replaceAll(' ', '_');
}

function exMaterialCategories(character: StudentInfo, metadata: MaterialMetadata): string[] {
  const materials = character.SkillExMaterial;
  const exMaterials = materials?.[3];
  if (!exMaterials) return [];

  const categories: string[] = [];
  for (const index of [2, 3]) {
    const id = exMaterials[index];
    if (id === undefined || id >= 1000) continue;

    const name = metadata.materialNames[String(id)];
    if (name === undefined) continue;
    // The final two characters distinguish tiers in the legacy material names.
    categories.push(name.slice(0, -2));
  }
  return categories;
}

/** List distinct EX-material category options, sorted by their legacy display name. */
export function availableExMaterialFilterOptions(
  characters: readonly StudentInfo[] | Record<string, StudentInfo>,
  metadata: MaterialMetadata
): ExMaterialFilterOption[] {
  const students = Array.isArray(characters) ? characters : Object.values(characters);
  const options = new Map<string, string>();

  for (const character of students) {
    for (const label of exMaterialCategories(character, metadata)) {
      const key = exMaterialFilterKey(label);
      if (key && !options.has(key)) options.set(key, label);
    }
  }

  return [...options].map(([key, label]) => ({ key, label })).sort((first, second) =>
    first.label < second.label ? -1 : first.label > second.label ? 1 : 0
  );
}

/** Return whether a character uses either EX material in the selected category. */
export function matchesExMaterialFilter(
  character: StudentInfo,
  selectedCategory: string,
  metadata: MaterialMetadata
): boolean {
  if (!selectedCategory) return false;
  const selectedKey = exMaterialFilterKey(selectedCategory);
  return exMaterialCategories(character, metadata).some((category) => exMaterialFilterKey(category) === selectedKey);
}
