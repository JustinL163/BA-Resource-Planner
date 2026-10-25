declare module 'sortablejs/modular/sortable.esm.js' {
  import Sortable = require('sortablejs');

  const SortableESM: typeof Sortable;
  export default SortableESM;
  export const Swap: typeof Sortable.Swap;
}
