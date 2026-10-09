import type { Action } from 'svelte/action';

export const modal: Action<HTMLDialogElement> = (node) => {
  const previous = document.activeElement;
  const overflow = document.body.style.overflow;
  node.showModal();
  document.body.style.overflow = 'hidden';
  return {
    destroy() {
      node.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    }
  };
};
