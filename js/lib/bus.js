/**
 * Minimal pub/sub so modules never import each other directly.
 *
 * Events in use:
 *   project:hover  (project)            grid → hud
 *   project:leave  ()                   grid → hud
 *   grid:filter    ({ filter, count })  grid → hud
 *   case:open      (project)            main → hud
 *   case:close     ()                   main → hud
 *   hud:say        ({ text, state })    anyone → hud
 */
const target = new EventTarget();

export const bus = {
  on(type, fn) {
    const handler = (event) => fn(event.detail);
    target.addEventListener(type, handler);
    return () => target.removeEventListener(type, handler);
  },
  emit(type, detail) {
    target.dispatchEvent(new CustomEvent(type, { detail }));
  },
};
