import { get, writable } from 'svelte/store';
import { calculateStudentResources } from '../domain/resources/calculator';
import { aggregateResources } from '../domain/planner/aggregates';
import { characterFingerprint, createCharacter } from '../domain/planner/defaults';
import { reorderVisibleCharacters } from '../domain/planner/card-display';
import { isRecord, parsePlannerSave, validateCharacterEdit } from '../domain/planner/save';
import type { PlannerCharacter, PlannerDataset, PlannerMetadata, PlannerSave, ResourceTotals } from '../domain/planner/types';
import type { Resources } from '../domain/resources/types';
import { loadCharacterNames, loadPlannerDataset, savedLanguage } from '../services/planner-data';
import { announceSaveChange } from '../services/save-events';
import { createGroupActions } from '../services/planner-groups';
import { applyBulkPatch, validateBulkPatch, type BulkPatch } from '../domain/planner/bulk';
import { farmServer, type FarmServer } from '../domain/planner/gear-farm';
import { validateCredentials, type CloudCredentials } from '../services/cloud-credentials';
import { writeStorageTransaction } from '../services/storage-transaction';

interface PlannerState {
  loading: boolean;
  error: string;
  saved: boolean;
  data: PlannerSave | null;
  dataset: PlannerDataset | null;
  names: Record<string, string>;
  scribble: boolean;
  migrated: boolean;
}

export function createResourcePlanner(metadata: PlannerMetadata, storageProvider: () => Storage = () => window.localStorage) {
  const state = writable<PlannerState>({
    loading: false, error: '', saved: false, data: null, dataset: null, names: {}, scribble: false, migrated: false
  });
  const namesCache = new Map<string, Record<string, string>>();
  const costsCache = new Map<string, { fingerprint: string; resources: Resources }>();
  let generation = 0;
  let writing = false;
  let signal: AbortSignal | undefined;
  type HistoryEntry = { undo: () => boolean; redo: () => boolean };
  const undoHistory: HistoryEntry[] = [];
  const redoHistory: HistoryEntry[] = [];
  const historyLimit = 100;

  function cloneSave(data: PlannerSave): PlannerSave {
    return JSON.parse(JSON.stringify(data)) as PlannerSave;
  }

  function pushHistory(entry: HistoryEntry) {
    undoHistory.push(entry);
    if (undoHistory.length > historyLimit) undoHistory.shift();
    redoHistory.length = 0;
  }

  function restoreSave(expected: PlannerSave, target: PlannerSave): boolean {
    const current = get(state);
    if (!current.dataset || !current.data) return false;
    try {
      const storage = storageProvider();
      const latest = parsePlannerSave(storage.getItem('save-data'), current.dataset.students, metadata, current.names);
      if (JSON.stringify(latest) !== JSON.stringify(expected)) {
        undoHistory.length = 0;
        redoHistory.length = 0;
        void reload();
        throw new Error('The saved plan changed elsewhere. Its local undo history was cleared.');
      }
      const restored = cloneSave(target);
      aggregateResources(current.dataset, restored.characters, restored.disabled_characters, restored.owned_materials, metadata.maxLevel);
      writing = true;
      storage.setItem('save-data', JSON.stringify(restored));
      state.update((value) => ({ ...value, data: restored, saved: true, error: '' }));
      announceSaveChange();
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      writing = false;
    }
  }

  function recordSaveChange(before: PlannerSave, after: PlannerSave) {
    pushHistory({
      undo: () => restoreSave(after, before),
      redo: () => restoreSave(before, after)
    });
  }

  function replayHistory(from: HistoryEntry[], to: HistoryEntry[], direction: 'undo' | 'redo'): boolean {
    const entry = from.pop();
    if (!entry) return false;
    try {
      const succeeded = entry[direction]();
      if (!succeeded) { from.push(entry); return false; }
      to.push(entry);
      return true;
    } catch (error) {
      from.push(entry);
      report(error);
      return false;
    }
  }

  function report(error: unknown) {
    console.error('Resource planner operation failed.', error);
    state.update((value) => ({
      ...value, loading: false, saved: false,
      error: error instanceof Error ? error.message : 'Resource planner operation failed.'
    }));
  }

  async function namesFor(source: string | null, dataset: PlannerDataset) {
    const language = savedLanguage(source);
    const cached = namesCache.get(language);
    if (cached) return cached;
    const names = await loadCharacterNames(language, dataset, signal);
    namesCache.set(language, names);
    return names;
  }

  async function reload() {
    if (writing) return;
    const current = get(state);
    if (!current.dataset) return;
    const token = ++generation;
    try {
      const storage = storageProvider();
      const source = storage.getItem('save-data');
      const names = await namesFor(source, current.dataset);
      if (token !== generation || signal?.aborted) return;
      // Re-read after asynchronous localization so another tab's newer save wins.
      const latest = storage.getItem('save-data');
      if (latest !== source) { await reload(); return; }
      const data = parsePlannerSave(source, current.dataset.students, metadata, names);
      aggregateResources(current.dataset, data.characters, data.disabled_characters, data.owned_materials, metadata.maxLevel);
      const original: unknown = source === null ? null : JSON.parse(source);
      const migrated = isRecord(original) && original.exportVersion !== 2;
      if (migrated && source !== null) {
        writing = true;
        try {
          storage.setItem('data-backup-modern', source);
          storage.setItem('save-data', JSON.stringify(data));
          announceSaveChange();
        } finally { writing = false; }
      }
      undoHistory.length = 0;
      redoHistory.length = 0;
      state.set({ ...current, data, names, scribble: storage.getItem('image-style') === 'true', loading: false, error: '', saved: false, migrated });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      report(error);
    }
  }

  function commit(change: (data: PlannerSave, dataset: PlannerDataset) => void): boolean {
    const current = get(state);
    if (!current.dataset || !current.data) { report(new Error('Planner data is not ready.')); return false; }
    try {
      const storage = storageProvider();
      const latest = parsePlannerSave(storage.getItem('save-data'), current.dataset.students, metadata, current.names);
      const before = cloneSave(latest);
      change(latest, current.dataset);
      // Validate calculations before touching the persisted save.
      aggregateResources(current.dataset, latest.characters, latest.disabled_characters, latest.owned_materials, metadata.maxLevel);
      writing = true;
      storage.setItem('save-data', JSON.stringify(latest));
      state.update((value) => ({ ...value, data: latest, saved: true, error: '' }));
      if (JSON.stringify(before) !== JSON.stringify(latest)) recordSaveChange(before, cloneSave(latest));
      announceSaveChange();
      return true;
    } catch (error) {
      report(error);
      return false;
    } finally {
      writing = false;
    }
  }

  return {
    subscribe: state.subscribe,
    ...createGroupActions(commit),
    recordUiHistory(undo: () => void, redo: () => void) {
      pushHistory({ undo: () => { undo(); return true; }, redo: () => { redo(); return true; } });
    },
    undo() { return replayHistory(undoHistory, redoHistory, 'undo'); },
    redo() { return replayHistory(redoHistory, undoHistory, 'redo'); },
    async initialise(abortSignal: AbortSignal | undefined = signal) {
      signal = abortSignal;
      state.update((value) => ({ ...value, loading: true, error: '' }));
      try {
        const dataset = get(state).dataset ?? await loadPlannerDataset(metadata, signal);
        if (signal?.aborted) return;
        state.update((value) => ({ ...value, dataset }));
        await reload();
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        report(error);
      }
    },
    reload,
    add(ids: string[]) {
      return commit((data, dataset) => {
        for (const id of ids) {
          if (!dataset.students[id]) throw new Error(`Unknown character: ${id}.`);
          if (!data.characters.some((character) => character.id === id)) {
            data.characters.push(createCharacter(dataset.students[id], metadata));
            if (!data.character_order.includes(id)) data.character_order.push(id);
          }
        }
      });
    },
    edit(character: PlannerCharacter, expected: string) {
      return commit((data, dataset) => {
        const index = data.characters.findIndex((item) => item.id === character.id);
        if (index < 0 || characterFingerprint(data.characters[index]) !== expected) {
          throw new Error('This character changed in another window. Close and reopen the editor before saving.');
        }
        validateCharacterEdit(character, dataset.students[character.id], metadata);
        const detached = parsePlannerSave(JSON.stringify({ exportVersion: 2, characters: [character] }),
          dataset.students, metadata, get(state).names).characters[0];
        data.characters[index] = {
          ...data.characters[index], current: { ...data.characters[index].current, ...detached.current },
          target: { ...data.characters[index].target, ...detached.target },
          eleph: { ...data.characters[index].eleph, ...detached.eleph }
        };
      });
    },
    remove(id: string) {
      return commit((data) => {
        data.characters = data.characters.filter((character) => character.id !== id);
        data.character_order = data.character_order.filter((item) => item !== id);
        data.disabled_characters = data.disabled_characters.filter((item) => item !== id);
      });
    },
    include(id: string, included: boolean) {
      return commit((data) => {
        const character = data.characters.find((item) => item.id === id);
        if (!character) throw new Error(`Character ${id} is no longer in the saved plan.`);
        character.enabled = included;
        data.disabled_characters = data.disabled_characters.filter((item) => item !== id);
        if (!included) data.disabled_characters.push(id);
      });
    },
    includeAll(included: boolean) {
      return commit((data) => {
        for (const character of data.characters) character.enabled = included;
        data.disabled_characters = included ? [] : data.characters.map((item) => item.id);
      });
    },
    includeMany(ids: string[], included: boolean) {
      return commit((data) => {
        const selected = new Set(ids);
        for (const character of data.characters) if (selected.has(character.id)) character.enabled = included;
        data.disabled_characters = data.disabled_characters.filter((id) => !selected.has(id));
        if (!included) data.disabled_characters.push(...data.characters.filter((item) => selected.has(item.id)).map((item) => item.id));
      });
    },
    bulkEdit(ids: string[], expected: Record<string, string>, patch: BulkPatch) {
      return commit((data, dataset) => {
        validateBulkPatch(patch, metadata);
        if (!ids.length) throw new Error('Select at least one character.');
        for (const id of ids) {
          const character = data.characters.find((item) => item.id === id);
          if (!character || characterFingerprint(character) !== expected[id]) {
            throw new Error('A selected character changed in another window. Reopen the bulk editor before saving.');
          }
        }
        const selected = new Set(ids);
        data.characters = data.characters.map((character) => selected.has(character.id) ?
          applyBulkPatch(character, dataset.students[character.id], patch) : character);
      });
    },
    owned(key: string, amount: number) {
      return commit((data) => {
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0) throw new Error('Owned amounts must be non-negative integers.');
        data.owned_materials[key] = amount;
      });
    },
    setServer(server: FarmServer) {
      return commit((data) => { data.server = farmServer(server); });
    },
    setImageStyle(scribble: boolean) {
      try {
        storageProvider().setItem('image-style', String(scribble));
        state.update((value) => ({ ...value, scribble, error: '' }));
        announceSaveChange();
        return true;
      } catch (error) {
        report(error);
        return false;
      }
    },
    move(id: string, direction: -1 | 1) {
      return commit((data) => {
        const order = data.character_order.filter((item) => data.characters.some((character) => character.id === item));
        for (const character of data.characters) if (!order.includes(character.id)) order.push(character.id);
        const index = order.indexOf(id);
        const destination = index + direction;
        if (index >= 0 && destination >= 0 && destination < order.length) {
          [order[index], order[destination]] = [order[destination], order[index]];
        }
        data.character_order = [...order, ...data.character_order.filter((item) => !order.includes(item))];
      });
    },
    reorder(source: string, target: string, after: boolean, visible: string[]) {
      return commit((data) => {
        const known = new Set(data.characters.map((character) => character.id));
        const order = [...new Set(data.character_order.filter((id) => known.has(id)))];
        for (const character of data.characters) if (!order.includes(character.id)) order.push(character.id);
        data.character_order = [
          ...reorderVisibleCharacters(order, visible, source, target, after),
          ...data.character_order.filter((id) => !known.has(id))
        ];
      });
    },
    totals(levelCap: number): ResourceTotals | null {
      const current = get(state);
      if (!current.data || !current.dataset) return null;
      const resources: Record<string, Resources> = {};
      for (const character of current.data.characters) {
        const fingerprint = characterFingerprint(character);
        const cached = costsCache.get(character.id);
        const cost = cached?.fingerprint === fingerprint ? cached.resources :
          calculateStudentResources(current.dataset.context, character, current.dataset.students[character.id]);
        costsCache.set(character.id, { fingerprint, resources: cost });
        resources[character.id] = cost;
      }
      return aggregateResources(current.dataset, current.data.characters, current.data.disabled_characters,
        current.data.owned_materials, levelCap, resources);
    },
    exportData(): string {
      const current = get(state);
      if (!current.data) throw new Error('Planner data is not ready.');
      return JSON.stringify(current.data, null, 2);
    },
    currentSource(): string {
      const current = get(state);
      if (!current.dataset || !current.data) throw new Error('Planner data is not ready.');
      const source = storageProvider().getItem('save-data');
      parsePlannerSave(source, current.dataset.students, metadata, current.names);
      return source ?? JSON.stringify(current.data);
    },
    async importData(source: string, options: { expectedSource?: string | null; credentials?: CloudCredentials } = {}): Promise<boolean> {
      const current = get(state);
      if (!current.dataset) { report(new Error('Planner data is not ready.')); return false; }
      try {
        const names = await namesFor(source, current.dataset);
        if (signal?.aborted) return false;
        const data = parsePlannerSave(source, current.dataset.students, metadata, names);
        aggregateResources(current.dataset, data.characters, data.disabled_characters, data.owned_materials, metadata.maxLevel);
        const storage = storageProvider();
        const previous = storage.getItem('save-data');
        if (Object.hasOwn(options, 'expectedSource') && previous !== options.expectedSource) {
          throw new Error('The local plan changed while loading. Nothing was replaced; download a backup and try again.');
        }
        if (options.credentials) validateCredentials(options.credentials);
        const writes: Record<string, string> = {};
        if (previous !== null) writes['data-backup-modern'] = previous;
        if (options.credentials) {
          writes.username = options.credentials.username;
          writes.authkey = options.credentials.authkey;
        }
        writes['save-data'] = JSON.stringify(data);
        const before = parsePlannerSave(previous, current.dataset.students, metadata, current.names);
        writing = true;
        writeStorageTransaction(storage, writes);
        generation++;
        costsCache.clear();
        state.set({ ...current, data, names, error: '', loading: false, saved: true, migrated: false });
        recordSaveChange(cloneSave(before), cloneSave(data));
        announceSaveChange();
        return true;
      } catch (error) { report(error); return false; }
      finally { writing = false; }
    }
  };
}
