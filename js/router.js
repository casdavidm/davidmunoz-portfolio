/**
 * Hash router.
 *   #/work/<slug>  → case-study drawer
 *   anything else  → page (plain #work / #specs / #contact anchors scroll natively,
 *                    so section links work even with JavaScript disabled)
 */
const CASE_ROUTE = /^#\/work\/([a-z0-9-]+)\/?$/i;

export const parseHash = (hash) => {
  const match = CASE_ROUTE.exec(hash);
  return match ? { name: 'case', slug: match[1].toLowerCase() } : { name: 'page', hash };
};

export function createRouter() {
  let current = null;
  let handler = () => {};

  const emit = (initial = false) => {
    const prev = current;
    current = parseHash(location.hash);
    handler(current, prev, { initial });
  };

  return {
    get current() {
      return current;
    },
    start(fn) {
      handler = fn;
      window.addEventListener('hashchange', () => emit());
      emit(true);
    },
    /** Swap the current entry (prev/next inside the drawer) without growing history. */
    replace(hash) {
      history.replaceState(history.state, '', hash);
      emit();
    },
    /** Drop the hash entirely without adding a history entry. */
    clear() {
      history.replaceState(history.state, '', location.pathname + location.search);
      emit();
    },
  };
}
