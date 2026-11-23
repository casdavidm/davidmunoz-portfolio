import { h } from './dom.js';

/** Four '+' registration marks for any position:relative frame. */
export const regMarks = () =>
  ['tl', 'tr', 'bl', 'br'].map((pos) => h('span', { class: `reg reg--${pos}`, 'aria-hidden': 'true' }, '+'));

/** "No signal" placeholder used when a case file has no media yet. */
export const noSignal = (project) =>
  h(
    'div',
    { class: 'ph', 'aria-hidden': 'true' },
    h('div', { class: 'ph__top mono' }, h('span', {}, `No signal // CH.${project.code}`), h('span', { class: 'led led--blink' })),
    h('div', { class: 'ph__glyph' }, project.monogram),
    h('div', { class: 'hazard' }),
  );

/** <dl class="spec-list"> from [label, value] rows; empty values are dropped. */
export const specList = (rows) =>
  h(
    'dl',
    { class: 'spec-list' },
    rows
      .filter(([, value]) => value != null && value !== '' && !(Array.isArray(value) && value.length === 0))
      .map(([label, value]) => h('div', {}, h('dt', { class: 'mono' }, label), h('dd', {}, value))),
  );

const ARROWS = {
  right: 'M1.5 8h12.5M8.5 2.5 14 8l-5.5 5.5',
  down: 'M8 1.5v12.5M2.5 8.5 8 14l5.5-5.5',
};

/** 16px stroke arrow (SVG needs its namespace, so it can't go through h()). */
export function arrowIcon(dir = 'right') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', ARROWS[dir] ?? ARROWS.right);
  svg.append(path);
  return svg;
}
