export const saveChangedEvent = 'ba-planner-save-changed';
export const localSaveEvent = 'ba-planner-local-save';
export const localSavePendingEvent = 'ba-planner-local-save-pending';
const localSaveToastDelayMs = 5000;
let localSaveToastTimer: ReturnType<typeof setTimeout> | undefined;

export function announceSaveChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(saveChangedEvent));
}

export function announceLocalSave(immediate = false): void {
  if (typeof window === 'undefined') return;
  if (localSaveToastTimer) clearTimeout(localSaveToastTimer);
  localSaveToastTimer = undefined;
  window.dispatchEvent(new Event(localSavePendingEvent));
  if (immediate) {
    window.dispatchEvent(new Event(localSaveEvent));
    return;
  }
  localSaveToastTimer = setTimeout(() => {
    localSaveToastTimer = undefined;
    window.dispatchEvent(new Event(localSaveEvent));
  }, localSaveToastDelayMs);
}
