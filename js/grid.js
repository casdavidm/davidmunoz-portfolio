import { h, qs, pad, reducedMotion } from './lib/dom.js';
import { noSignal, arrowIcon } from './lib/ui.js';
import { matchesFilter } from './data.js';

/** Asymmetric 12-column rhythm: 7/5 · 5/7 · 4/4/4 — repeats every 7 tiles. */
const RHYTHM = [7, 5, 5, 7, 4, 4, 4];
const SHAPE = { 7: 'wide', 5: 'mid', 4: 'std' };

/**
 * Filterable archive grid.
 * Emits project:hover / project:leave / grid:filter on the bus.
 */
export function createGrid({ data, bus }) {
  const root = qs('[data-grid]');
  const bar = qs('[data-filters]');
  const live = qs('[data-grid-status]');
  const indexLabel = qs('[data-grid-index]');
  const { projects, filters } = data;

  let active = filters[0].id;

  /* ---- Build -------------------------------------------------------- */
  const cells = projects.map((p) => ({ project: p, el: renderTile(p) }));
  const endTile = renderEnd(projects.length);
  root.replaceChildren(...cells.map((c) => c.el), endTile);

  const countFor = (filter) => projects.filter((p) => matchesFilter(p, filter)).length;

  const buttons = filters.map((f) =>
    h(
      'button',
      { type: 'button', class: 'filter mono', 'aria-pressed': 'false', tabindex: '-1', dataset: { filter: f.id } },
      h('span', { class: 'filter__label' }, f.label),
      h('sup', { class: 'filter__count', 'aria-label': `${countFor(f)} case files` }, pad(countFor(f))),
    ),
  );
  bar.replaceChildren(...buttons);
  if (indexLabel) indexLabel.textContent = `${pad(projects.length)} case files`;

  /* ---- Filter ------------------------------------------------------- */
  function apply(id, { initial = false } = {}) {
    const filter = filters.find((f) => f.id === id) ?? filters[0];
    active = filter.id;

    const commit = () => {
      let slot = 0;
      let rowUsed = 0;
      for (const { project, el } of cells) {
        const show = matchesFilter(project, filter);
        el.hidden = !show;
        if (!show) continue;
        const span = RHYTHM[slot % RHYTHM.length];
        el.style.setProperty('--span', span);
        el.dataset.shape = SHAPE[span];
        rowUsed = (rowUsed + span) % 12;
        slot += 1;
      }
      // Close the last row with an "end of file" card when it's incomplete.
      const leftover = rowUsed ? 12 - rowUsed : 0;
      endTile.hidden = leftover === 0;
      endTile.style.setProperty('--span', leftover || 12);

      for (const b of buttons) {
        const on = b.dataset.filter === active;
        b.setAttribute('aria-pressed', String(on));
        b.tabIndex = on ? 0 : -1;
      }
    };

    if (!initial && document.startViewTransition && !reducedMotion.matches) document.startViewTransition(commit);
    else commit();

    const count = countFor(filter);
    if (!initial) live.textContent = `${count} case files shown: ${filter.label}`;
    bus.emit('grid:filter', { filter, count, initial });
  }

  /* ---- Toolbar (roving tabindex) ------------------------------------- */
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (btn && btn.dataset.filter !== active) apply(btn.dataset.filter);
  });

  bar.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next = null;
    if (e.key in moves) next = buttons[(i + moves[e.key] + buttons.length) % buttons.length];
    else if (e.key === 'Home') next = buttons[0];
    else if (e.key === 'End') next = buttons[buttons.length - 1];
    if (!next) return;
    e.preventDefault();
    buttons.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
    next.focus();
  });

  /* ---- Hover / focus telemetry → HUD --------------------------------- */
  let hovered = null;
  const enter = (link) => {
    if (link === hovered) return;
    hovered = link;
    if (link) bus.emit('project:hover', data.bySlug.get(link.dataset.slug));
    else bus.emit('project:leave');
  };

  root.addEventListener('pointerover', (e) => enter(e.target.closest('.tile__link')));
  root.addEventListener('pointerleave', () => enter(null));
  root.addEventListener('focusin', (e) => enter(e.target.closest('.tile__link')));
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) enter(null);
  });

  apply(active, { initial: true });

  return {
    visible: () => cells.filter((c) => !c.el.hidden).map((c) => c.project),
    cardFor: (slug) => qs(`.tile__link[data-slug="${CSS.escape(slug)}"]`, root),
  };
}

/* ---- Templates ----------------------------------------------------------- */
function renderTile(p) {
  const titleId = `tile-title-${p.slug}`;
  const sumId = `tile-sum-${p.slug}`;

  const media = p.cover
    ? h('img', {
        src: p.cover.src,
        width: p.cover.width,
        height: p.cover.height,
        alt: '',
        loading: p.index <= 2 ? 'eager' : 'lazy',
        decoding: 'async',
      })
    : noSignal(p);

  return h(
    'li',
    { class: 'tile', style: `view-transition-name: case-${p.slug}` },
    h(
      'a',
      {
        class: 'tile__link',
        href: `#/work/${p.slug}`,
        'aria-labelledby': titleId,
        'aria-describedby': sumId,
        dataset: { slug: p.slug },
      },
      h(
        'div',
        { class: 'tile__media' },
        media,
        h(
          'span',
          { class: 'corner-arrow tile__go', 'aria-hidden': 'true' },
          arrowIcon('right'),
        ),
      ),
      h(
        'div',
        { class: 'tile__body' },
        h('h3', { class: 'tile__title', id: titleId }, p.title),
        h(
          'p',
          { class: 'tile__info mono', 'aria-hidden': 'true' },
          h('span', {}, p.code),
          h('span', {}, p.category),
          h('span', {}, p.isDraft ? 'No signal' : p.year || 'TBD'),
        ),
        h('p', { class: 'tile__sum visually-hidden', id: sumId }, p.summary),
      ),
    ),
  );
}

function renderEnd(total) {
  return h(
    'li',
    { class: 'tile tile--end' },
    h(
      'a',
      { class: 'tile__next', href: '#contact' },
      h('span', { class: 'mono' }, `EOF // ${pad(total)} files `, h('span', { class: 'jp', lang: 'ja', 'aria-hidden': 'true' }, '終')),
      h('strong', {}, 'Your project', h('br'), 'could be next'),
      h('span', { class: 'mono' }, 'Open a channel ->'),
    ),
  );
}
