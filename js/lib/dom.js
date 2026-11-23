/**
 * Tiny DOM toolkit. No templating strings → no injection surface:
 * every value from projects.json lands in the DOM as text or an attribute.
 */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * h('a', { class: 'card', href: '#', dataset: { slug } }, 'child', node, [more])
 * - null / false props and children are skipped
 * - on* props with function values become event listeners
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return el;
}

/** Zero-padded index: pad(3) → "03", pad(7, 3) → "007" */
export const pad = (n, len = 2) => String(n).padStart(len, '0');

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
