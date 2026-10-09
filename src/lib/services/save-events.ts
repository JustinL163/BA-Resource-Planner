export const saveChangedEvent = 'ba-planner-save-changed';

export function announceSaveChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(saveChangedEvent));
}
