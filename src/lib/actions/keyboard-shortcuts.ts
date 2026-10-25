const editableTargetSelector = 'input, textarea, select, [contenteditable="true"], [role="textbox"]';

/** Activates a matching shortcut in the topmost open dialog, or the page when no dialog is open. */
export function activateLetterShortcut(event: KeyboardEvent): boolean {
  if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
    !/^[a-z]$/i.test(event.key)) return false;

  const eventTarget = event.target instanceof Element ? event.target : null;
  if (eventTarget?.closest(editableTargetSelector)) return false;

  const openDialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const scope: ParentNode = openDialogs.item(openDialogs.length - 1) ?? document;
  const key = event.key.toLowerCase();
  const shortcutTarget = Array.from(scope.querySelectorAll<HTMLElement>('[data-key-shortcut]'))
    .find((candidate) => candidate.dataset.keyShortcut?.toLowerCase() === key &&
      !candidate.matches(':disabled, [aria-disabled="true"]') && candidate.getClientRects().length > 0);

  if (!shortcutTarget) return false;
  const numericInput = eventTarget?.closest('input[type="number"]');
  const allowedInNumberInput = Boolean(numericInput && shortcutTarget.hasAttribute('data-key-shortcut-allow-number-input'));
  if ((event.defaultPrevented && !allowedInNumberInput) ||
    (eventTarget?.closest(editableTargetSelector) && !allowedInNumberInput)) return false;

  event.preventDefault();
  shortcutTarget.click();
  return true;
}
