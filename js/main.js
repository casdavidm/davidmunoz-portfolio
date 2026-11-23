/**
 * DAVID MUÑOZ // PORTFOLIO — bootstrap
 * Zero dependencies. ES modules only. Data: /data/projects.json
 */
import { h, qs, qsa } from './lib/dom.js';
import { bus } from './lib/bus.js';
import { loadData } from './data.js';
import { createRouter } from './router.js';
import { createGrid } from './grid.js';
import { createDrawer } from './drawer.js';
import { createHud } from './hud.js';
import { renderSpecs } from './specs.js';
import { hydrateProfile, bindCopyEmail } from './profile.js';
import { startClock } from './clock.js';
import { runBoot } from './boot.js';
import { initSnap } from './snap.js';

const BASE_TITLE = document.title;

async function boot() {
  const dataPromise = loadData();
  const heroArt = qs('.hero__figure');
  runBoot(
    Promise.all([
      dataPromise,
      document.fonts?.ready,
      heroArt && !heroArt.complete ? new Promise((r) => heroArt.addEventListener('load', r, { once: true })) : null,
    ]),
  );

  navSpy();
  initSnap();

  let data;
  try {
    data = await dataPromise;
  } catch (err) {
    startClock();
    renderDataError(err);
    return;
  }

  startClock(data.profile?.location?.timezone);
  hydrateProfile(data.profile, data);
  createHud({ data, bus });
  const grid = createGrid({ data, bus });
  renderSpecs(data);
  bindCopyEmail(data.profile?.contact?.email, bus);

  /* ---- Routing: #/work/<slug> ⇄ drawer --------------------------------- */
  const router = createRouter();
  let openedInApp = false; // true → closing can simply step back in history

  const sequenceFor = (slug) => {
    const visible = grid.visible();
    return visible.some((p) => p.slug === slug) ? visible : data.projects;
  };

  const drawer = createDrawer({
    onRequestClose() {
      if (openedInApp) history.back();
      else router.clear();
    },
    onStep(direction) {
      const current = drawer.current;
      if (!current) return;
      const seq = sequenceFor(current.slug);
      const i = seq.findIndex((p) => p.slug === current.slug);
      const next = seq[(i + direction + seq.length) % seq.length];
      if (next && next.slug !== current.slug) router.replace(`#/work/${next.slug}`);
    },
  });

  router.start((route, prev, { initial }) => {
    if (route.name === 'case') {
      const project = data.bySlug.get(route.slug);
      if (!project) {
        bus.emit('hud:say', { text: `Err 404 // Case file "${route.slug}" not found`, state: 'err' });
        router.clear();
        return;
      }
      if (!drawer.isOpen) {
        openedInApp = !initial && prev?.name !== 'case';
        if (initial) drawer.setReturnFocus(grid.cardFor(project.slug));
      }
      drawer.open(project, sequenceFor(project.slug));
      document.title = `${project.title} — Case file — David Muñoz`;
      bus.emit('case:open', project);
      return;
    }

    if (drawer.isOpen) {
      drawer.close();
      bus.emit('case:close');
    }
    openedInApp = false;
    document.title = BASE_TITLE;
  });

  // Sections below the archive moved once it rendered; re-align a section deep link.
  if (location.hash && !location.hash.startsWith('#/')) {
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}

/* Highlight the nav link of the section crossing the viewport's middle band. */
function navSpy() {
  const links = new Map(qsa('[data-nav]').map((a) => [a.dataset.nav, a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a, id) => {
          if (id === entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  ['top', 'work', 'specs', 'contact'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

function renderDataError(err) {
  console.error('[portfolio] data link failed:', err);
  const isFile = location.protocol === 'file:';

  qs('[data-grid]').replaceChildren(
    h(
      'li',
      { class: 'tile tile--end', style: '--span:12' },
      h(
        'div',
        { class: 'grid-error', role: 'alert' },
        h('p', { class: 'mono' }, '[ERR 0x01] Data link failed — projects.json unreachable'),
        isFile
          ? h(
              'p',
              {},
              'This page was opened straight from disk, and browsers block data requests from file:// URLs. Serve the folder instead: ',
              h('code', {}, 'python3 tools/serve.py'),
              ', then open http://localhost:8080.',
            )
          : h('p', {}, 'The case-file index could not be loaded. Refresh to retry.'),
        h('p', { class: 'mono' }, String(err?.message ?? err)),
      ),
    ),
  );

  qsa('[data-hud-text]').forEach((el) => (el.textContent = 'ERR 0x01 // DATA LINK FAILED // CHECK CONSOLE'));
  qsa('[data-hud-state]').forEach((el) => (el.textContent = 'Fault'));
}

boot();
