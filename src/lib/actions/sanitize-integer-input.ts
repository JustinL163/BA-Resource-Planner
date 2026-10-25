import type { Action } from 'svelte/action';

function isDigitText(value: string): boolean {
  return /^\d+$/.test(value);
}

function finiteBound(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const bound = Number(value);
  return Number.isFinite(bound) ? bound : undefined;
}

function readBounds(input: HTMLInputElement): { min?: number; max?: number } {
  return {
    min: finiteBound(input.min),
    max: finiteBound(input.max)
  };
}

function setValue(input: HTMLInputElement, value: string, emitInput: boolean): void {
  if (input.value === value) return;
  input.value = value;
  if (emitInput) input.dispatchEvent(new Event('input', { bubbles: true }));
}

export const sanitizeIntegerInput: Action<HTMLInputElement> = (input) => {
  let lastValid = input.value;
  let dispatchingInput = false;
  let touchPointer = false;
  let replaceOnTouchInput = false;

  function selectOrPrepareReplacement(): void {
    if (touchPointer) replaceOnTouchInput = true;
    else input.select();
  }

  function insertedText(previous: string, current: string): string {
    let start = 0;
    while (start < previous.length && start < current.length && previous[start] === current[start]) start++;
    let previousEnd = previous.length;
    let currentEnd = current.length;
    while (previousEnd > start && currentEnd > start && previous[previousEnd - 1] === current[currentEnd - 1]) {
      previousEnd--;
      currentEnd--;
    }
    return current.slice(start, currentEnd);
  }

  function replaceValue(value: string): void {
    replaceOnTouchInput = false;
    input.value = value;
    sanitize(false, false);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function sanitize(commit: boolean, emitInput: boolean): void {
    const raw = input.value;
    const allowBlank = input.hasAttribute('data-allow-blank');

    if (raw === '') {
      if (!commit) return;
      if (allowBlank) {
        lastValid = '';
        return;
      }

      const { min } = readBounds(input);
      if (min !== undefined) {
        lastValid = String(Math.ceil(min));
        setValue(input, lastValid, emitInput);
      } else if (input.required && lastValid !== '') {
        setValue(input, lastValid, emitInput);
      } else {
        lastValid = '';
      }
      return;
    }

    if (!isDigitText(raw)) {
      setValue(input, lastValid, emitInput);
      return;
    }

    const { min, max } = readBounds(input);
    let value = Number(raw);
    if (!Number.isSafeInteger(value)) value = Number.MAX_SAFE_INTEGER;
    if (max !== undefined && value > max) value = Math.floor(max);
    if (commit && min !== undefined && value < min) value = Math.ceil(min);
    value = Math.max(0, value);

    const normalized = String(value);
    lastValid = normalized;
    setValue(input, normalized, emitInput);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  }

  function onBeforeInput(event: InputEvent): void {
    if (event.data !== null && event.data !== '' && !isDigitText(event.data)) event.preventDefault();
    if (!replaceOnTouchInput) return;
    if (event.inputType.startsWith('delete')) {
      replaceOnTouchInput = false;
    } else if (event.inputType.startsWith('insert') && event.data && isDigitText(event.data)) {
      event.preventDefault();
      replaceValue(event.data);
    }
  }

  function onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text');
    if (pasted === undefined || pasted === '') return;
    if (!isDigitText(pasted)) event.preventDefault();
    else if (replaceOnTouchInput) {
      event.preventDefault();
      replaceValue(pasted);
    }
  }

  function onDrop(event: DragEvent): void {
    const dropped = event.dataTransfer?.getData('text');
    if (dropped === undefined || dropped === '') return;
    if (!isDigitText(dropped)) event.preventDefault();
    else if (replaceOnTouchInput) {
      event.preventDefault();
      replaceValue(dropped);
    }
  }

  function onPointerDown(event: PointerEvent): void {
    touchPointer = event.pointerType === 'touch' || event.pointerType === 'pen';
    replaceOnTouchInput = touchPointer;
  }

  function onPointerCancel(): void {
    touchPointer = false;
    replaceOnTouchInput = false;
  }

  function onClick(): void {
    if (!touchPointer) input.select();
    touchPointer = false;
  }

  function onInput(event: Event): void {
    if (dispatchingInput) return;
    if (replaceOnTouchInput) {
      const inputEvent = event as InputEvent;
      const inserted = inputEvent.inputType?.startsWith('insert') && inputEvent.data && isDigitText(inputEvent.data)
        ? inputEvent.data
        : insertedText(lastValid, input.value);
      replaceOnTouchInput = false;
      if (inserted && isDigitText(inserted)) input.value = inserted;
    }
    sanitize(false, false);
  }

  function onChange(): void {
    replaceOnTouchInput = false;
    dispatchingInput = true;
    try {
      sanitize(true, true);
    } finally {
      dispatchingInput = false;
    }
  }

  function onFocusOut(): void {
    replaceOnTouchInput = false;
    dispatchingInput = true;
    try {
      sanitize(true, true);
    } finally {
      dispatchingInput = false;
    }
  }

  const form = input.form;
  function onSubmit(): void {
    replaceOnTouchInput = false;
    dispatchingInput = true;
    try {
      sanitize(true, true);
    } finally {
      dispatchingInput = false;
    }
  }

  input.addEventListener('keydown', onKeyDown, true);
  input.addEventListener('beforeinput', onBeforeInput, true);
  input.addEventListener('paste', onPaste, true);
  input.addEventListener('drop', onDrop, true);
  input.addEventListener('pointerdown', onPointerDown, true);
  input.addEventListener('pointercancel', onPointerCancel, true);
  input.addEventListener('focusin', selectOrPrepareReplacement);
  input.addEventListener('click', onClick);
  input.addEventListener('input', onInput, true);
  input.addEventListener('change', onChange, true);
  input.addEventListener('focusout', onFocusOut, true);
  form?.addEventListener('submit', onSubmit, true);

  return {
    destroy() {
      input.removeEventListener('keydown', onKeyDown, true);
      input.removeEventListener('beforeinput', onBeforeInput, true);
      input.removeEventListener('paste', onPaste, true);
      input.removeEventListener('drop', onDrop, true);
      input.removeEventListener('pointerdown', onPointerDown, true);
      input.removeEventListener('pointercancel', onPointerCancel, true);
      input.removeEventListener('focusin', selectOrPrepareReplacement);
      input.removeEventListener('click', onClick);
      input.removeEventListener('input', onInput, true);
      input.removeEventListener('change', onChange, true);
      input.removeEventListener('focusout', onFocusOut, true);
      form?.removeEventListener('submit', onSubmit, true);
    }
  };
};
