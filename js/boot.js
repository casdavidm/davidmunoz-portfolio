import { qs, h, pad } from './lib/dom.js';

const MIN_MS = 1300;  // never flash by faster than this
const MAX_MS = 4000;  // never hold the visitor longer than this
const EXIT_MS = 520;  // keep in sync with .boot.is-done transition
const LINES = [
  'Mounting archive',
  'Calibrating reticle',
  'Syncing Toronto clock',
  'Waking unit DM-01',
  'Handshake',
];

/**
 * First-visit boot overlay (2Advanced homage). The inline script in <head>
 * decides whether to show it; this only animates and dismisses it.
 * Progress tracks real work: `ready` resolves when data, fonts and hero art are in.
 */
export function runBoot(ready) {
  const html = document.documentElement;
  if (!html.classList.contains('is-booting')) return;

  const el = qs('[data-boot]');
  const bar = qs('[data-boot-bar]', el);
  const pct = qs('[data-boot-pct]', el);
  const log = qs('[data-boot-log]', el);
  const start = performance.now();

  let progress = 0;
  let target = 0.82;
  let finished = false;
  let line = 0;
  let raf = 0;

  const tick = () => {
    progress += (target - progress) * 0.08;
    if (target === 1 && progress > 0.995) progress = 1;
    bar.parentElement.style.setProperty('--p', `${(progress * 100).toFixed(1)}%`);
    pct.textContent = `${pad(Math.round(progress * 100), 3)}%`;
    if (!finished) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const logTimer = setInterval(() => {
    if (line >= LINES.length) return clearInterval(logTimer);
    log.append(h('li', {}, `${LINES[line++]} `, h('span', { class: 'ok' }, '.... OK')));
  }, 230);

  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(logTimer);
    cancelAnimationFrame(raf);
    bar.parentElement.style.setProperty('--p', '100%');
    pct.textContent = '100%';
    try {
      sessionStorage.setItem('dm-booted', '1');
    } catch {
      /* private mode */
    }
    el.classList.add('is-done');
    setTimeout(() => html.classList.remove('is-booting'), EXIT_MS);
    removeEventListener('keydown', finish);
  };

  el.addEventListener('click', finish);
  addEventListener('keydown', finish);

  const minDelay = new Promise((r) => setTimeout(r, MIN_MS));
  Promise.resolve(ready)
    .catch(() => {})
    .then(() => {
      target = 1;
      return minDelay;
    })
    .then(() => setTimeout(finish, Math.max(0, 260 - (performance.now() - start - MIN_MS))));

  setTimeout(finish, MAX_MS);
}
