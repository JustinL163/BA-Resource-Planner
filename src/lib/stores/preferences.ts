import { writable } from 'svelte/store';
import { announceSaveChange } from '../services/save-events';
import {
  defaultPreferences, readPreferences, writePreferences, type Preferences
} from '../services/preferences';

interface PreferenceState extends Preferences {
  ready: boolean;
  error: string;
}

function createPreferences() {
  const state = writable<PreferenceState>({ ...defaultPreferences, ready: false, error: '' });

  function reportFailure(error: unknown) {
    console.error('Unable to access planner preferences.', error);
    state.update((value) => ({
      ...value,
      ready: true,
      error: 'Unable to read or save preferences. Existing planner data has not been replaced.'
    }));
  }

  return {
    subscribe: state.subscribe,
    initialise() {
      try {
        state.set({ ...readPreferences(window.localStorage), ready: true, error: '' });
      } catch (error) {
        reportFailure(error);
      }
    },
    update(patch: Partial<Preferences>) {
      try {
        state.set({ ...writePreferences(window.localStorage, patch), ready: true, error: '' });
        announceSaveChange();
      } catch (error) {
        reportFailure(error);
      }
    }
  };
}

export const preferences = createPreferences();
