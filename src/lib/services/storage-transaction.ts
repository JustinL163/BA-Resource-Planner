export function writeStorageTransaction(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, values: Record<string, string | null>
): void {
  const entries = Object.entries(values);
  const previous = new Map(entries.map(([key]) => [key, storage.getItem(key)]));
  const changed: string[] = [];
  try {
    for (const [key, value] of entries) {
      if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      changed.push(key);
    }
  } catch (error) {
    const failures: unknown[] = [error];
    for (const key of changed.reverse()) {
      try {
        const value = previous.get(key);
        if (value === null || value === undefined) storage.removeItem(key); else storage.setItem(key, value);
      } catch (rollback) { failures.push(rollback); }
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Local storage could not be saved or fully restored. Keep a separate copy of your plan.');
    }
    throw error;
  }
}
