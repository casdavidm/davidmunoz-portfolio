import { h, qs, pad, reducedMotion } from './lib/dom.js';
import { specList } from './lib/ui.js';
import { frameCount } from './data.js';

const CLOSE_MS = 400; // keep in sync with --dur-3 in tokens.css

/**
 * Slide-over case-study drawer built on <dialog>: native modality, inert
 * background, Esc via the `cancel` event. Routing decisions stay in main.js;
 * the drawer only asks to close or step.
 */
export function createDrawer({ onRequestClose, onStep }) {
  const dialog = qs('#case-drawer');
  const body = qs('[data-drawer-body]', dialog);
  const crumb = qs('[data-drawer-crumb]', dialog);
  const stepButtons = [...dialog.querySelectorAll('[data-drawer-step]')];

  let current = null;
  let isOpen = false;
  let returnFocus = null;
  let closeTimer = 0;

  /* ---- Events --------------------------------------------------------- */
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    onRequestClose();
  });

  // If the browser force-closes the dialog (e.g. repeated Esc), resync the route.
  dialog.addEventListener('close', () => {
    if (isOpen) {
      isOpen = false;
      dialog.classList.remove('is-open');
      body.replaceChildren(); // close() won't run its finish step on this path
      onRequestClose();
    }
  });

  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-dismiss]')) return onRequestClose();

    const step = e.target.closest('[data-drawer-step]');
    if (step) return onStep(Number(step.dataset.drawerStep));

    const pager = e.target.closest('[data-pager]');
    if (pager && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      e.preventDefault();
      onStep(Number(pager.dataset.pager));
    }
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.target.closest('video, input, textarea, select')) return; // let media controls keep their arrows
    if (e.key === 'ArrowRight') onStep(1);
    else if (e.key === 'ArrowLeft') onStep(-1);
  });

  /* ---- API ------------------------------------------------------------ */
  function open(project, sequence) {
    clearTimeout(closeTimer);
    const swapping = isOpen && current && current.slug !== project.slug;
    current = project;
    render(project, sequence);

    if (!dialog.open) {
      returnFocus ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // showModal() focuses the first control inside the still off-screen panel;
      // where the dialog is a scroll container that scrolls it sideways. Undo it.
      dialog.scrollLeft = 0;
      void dialog.offsetWidth; // flush styles so the slide-in transition runs
    }
    dialog.classList.add('is-open');
    isOpen = true;

    if (swapping && !reducedMotion.matches) {
      body.classList.remove('is-swapping');
      void body.offsetWidth;
      body.classList.add('is-swapping');
    }

    body.scrollTop = 0;
    qs('#case-title', body)?.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    dialog.classList.remove('is-open');

    const finish = () => {
      if (isOpen) return;
      if (dialog.open) dialog.close();
      body.classList.remove('is-swapping');
      body.replaceChildren(); // stops any playing video/embed inside the closed dialog
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      current = null;
    };

    clearTimeout(closeTimer);
    if (reducedMotion.matches) finish();
    else closeTimer = setTimeout(finish, CLOSE_MS);
  }

  /* ---- Render --------------------------------------------------------- */
  function render(p, sequence) {
    const seq = sequence.length ? sequence : [p];
    const i = Math.max(0, seq.findIndex((x) => x.slug === p.slug));
    const prev = seq[(i - 1 + seq.length) % seq.length];
    const next = seq[(i + 1) % seq.length];
    const multi = seq.length > 1;

    stepButtons.forEach((b) => (b.hidden = !multi));
    crumb.replaceChildren(
      h('span', {}, h('span', { class: 'drawer__crumb-label' }, 'Case file™ '), `${pad(i + 1)}/${pad(seq.length)}`),
      h('span', { 'aria-hidden': 'true' }, '//'),
      h('strong', {}, p.title),
    );

    const keyVisual = p.hero ?? p.cover;
    body.replaceChildren(
      h(
        'article',
        { class: 'case' },
        renderHero(p),
        keyVisual &&
          h('div', { class: 'case__cover' }, figure(keyVisual, 'FIG.00', keyVisual.caption || 'Key visual', { eager: true })),
        p.isDraft && renderPending(p),
        renderBrief(p),
        renderDeliverables(p),
        renderGallery(p),
        multi && renderPager(prev, next),
      ),
    );
  }

  return {
    open,
    close,
    get isOpen() {
      return isOpen;
    },
    get current() {
      return current;
    },
    /** Where focus lands after closing when the drawer was deep-linked. */
    setReturnFocus(el) {
      returnFocus = el ?? null;
    },
  };
}

/* ---- Templates ----------------------------------------------------------- */
function renderHero(p) {
  return h(
    'header',
    { class: 'case__hero' },
    h(
      'div',
      { class: 'case__intro' },
      h(
        'div',
        { class: 'case__eyebrow' },
        h('span', { class: 'mono' }, `[${p.code} // ${p.disciplineLabels.join(' + ')}]`),
        h('span', { class: 'badge' }, p.category),
        p.isDraft && h('span', { class: 'badge badge--hollow mono' }, 'File incoming'),
        p.disciplineJp.length && h('span', { class: 'jp', lang: 'ja', 'aria-hidden': 'true' }, `事例・${p.disciplineJp.join('・')}`),
      ),
      h('h2', { class: 'case__title', id: 'case-title', tabindex: '-1' }, p.title),
      h('p', { class: 'case__client mono' }, p.client),
      h('p', { class: 'case__lede' }, p.overview || p.summary),
    ),
    h(
      'div',
      { class: 'case__specs' },
      specList([
        ['Client', p.client],
        ['Year', p.year || 'TBD'],
        ['Sector', p.sector],
        ['Discipline', p.disciplineLabels.join(' / ')],
        ['Category', p.category],
        p.hero?.duration
          ? ['Runtime', p.hero.duration]
          : ['Frames', p.isDraft && !frameCount(p) ? 'Pending' : pad(frameCount(p))],
        ['Status', p.isDraft ? 'In production' : 'Published'],
      ]),
    ),
  );
}

function renderPending(p) {
  return h(
    'div',
    { class: 'case__pending on-dark' },
    h('p', { class: 'mono' }, `No signal // CH.${p.code} `, h('span', { class: 'jp', lang: 'ja' }, '信号なし・準備中')),
    h('div', { class: 'ph__glyph', 'aria-hidden': 'true' }, p.monogram),
    h('p', {}, 'This case file is being prepared for publication. Full breakdown, media and specs incoming.'),
    h('div', { class: 'hazard', 'aria-hidden': 'true' }),
  );
}

function renderBrief(p) {
  if (!p.challenge && !p.solution) return null;
  const block = (n, title, jpTitle, text) =>
    text &&
    h(
      'div',
      { class: 'brief-block' },
      h('h3', {}, h('span', { class: 'brief-block__n mono' }, n), title, h('span', { class: 'jp', lang: 'ja', 'aria-hidden': 'true' }, jpTitle)),
      h('p', {}, text),
    );
  return [
    sectionBar('Brief', '概要', 'Challenge // Solution'),
    h(
      'section',
      { class: 'case__brief', 'aria-label': 'Challenge and solution' },
      block('01', 'Challenge', '課題', p.challenge),
      block('02', 'Solution', '解決', p.solution),
    ),
  ];
}

/** 2Advanced-style module bar used inside the case file. */
function sectionBar(name, jpName, meta) {
  return h(
    'div',
    { class: 'case__section-bar mono', 'aria-hidden': 'true' },
    h('span', { class: 'module__name' }, name),
    h('span', { class: 'jp', lang: 'ja' }, jpName),
    h('span', { class: 'module__line' }),
    h('span', { class: 'module__meta' }, meta),
  );
}

function renderDeliverables(p) {
  if (!p.deliverables.length) return null;
  return [
    sectionBar('Deliverables', '成果物', pad(p.deliverables.length)),
    h('ul', { class: 'case__deliverables mono', 'aria-label': 'Deliverables' }, p.deliverables.map((d) => h('li', {}, d))),
  ];
}

function renderGallery(p) {
  if (!p.gallery.length) return null;

  // Landscape frames run full width; portrait/square frames pair up.
  // An unpaired half-width frame is promoted to full width so the grid closes.
  const isWide = (item) => (item.width || 16) / (item.height || 9) >= 1.25;
  const halves = p.gallery.filter((g) => !isWide(g));
  const lastHalf = halves.length % 2 ? halves[halves.length - 1] : null;

  return [
    sectionBar('Gallery', '図版', `${pad(p.gallery.length)} frames`),
    h(
      'div',
      { class: 'case__gallery' },
      p.gallery.map((item, i) =>
        figure(item, `FIG.${pad(i + 1)}`, item.caption, { wide: isWide(item) || item === lastHalf }),
      ),
    ),
  ];
}

function renderPager(prev, next) {
  return h(
    'nav',
    { class: 'case__pager', 'aria-label': 'More case files' },
    h(
      'a',
      { class: 'pager-link', href: `#/work/${prev.slug}`, dataset: { pager: '-1' } },
      h('span', { class: 'mono' }, `<- Prev // ${prev.code}`),
      h('strong', {}, prev.title),
    ),
    h(
      'a',
      { class: 'pager-link', href: `#/work/${next.slug}`, dataset: { pager: '1' } },
      h('span', { class: 'mono' }, `Next // ${next.code} ->`),
      h('strong', {}, next.title),
    ),
  );
}

/**
 * Gallery item types:
 *   { type: "image", src, width, height, alt, caption }
 *   { type: "video", src, poster, width, height, caption }          (self-hosted mp4/webm)
 *   { type: "embed", src, width, height, title, caption }           (Vimeo / YouTube player URL)
 */
function figure(item, label, caption, { wide = false, eager = false } = {}) {
  let media;
  if (item.type === 'video') {
    media = h('video', {
      src: item.src,
      poster: item.poster,
      width: item.width,
      height: item.height,
      controls: true,
      playsinline: true,
      preload: 'metadata',
    });
  } else if (item.type === 'embed') {
    media = item.poster ? embedFacade(item, caption, eager) : embedFrame(item, caption);
  } else {
    media = h('img', {
      src: item.src,
      width: item.width,
      height: item.height,
      alt: item.alt ?? '',
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
    });
  }

  return h(
    'figure',
    { class: `case__figure${wide ? ' is-wide' : ''}` },
    media,
    h(
      'figcaption',
      { class: 'mono' },
      h('span', {}, label),
      h('span', {}, caption || ''),
      item.width && item.height ? h('span', {}, `${item.width}×${item.height}`) : null,
    ),
  );
}

function embedFrame(item, caption, { autoplay = false } = {}) {
  const src = autoplay ? `${item.src}${item.src.includes('?') ? '&' : '?'}autoplay=1` : item.src;
  return h('iframe', {
    src,
    title: item.title || caption || 'Embedded media',
    style: `width:100%;aspect-ratio:${item.width || 16}/${item.height || 9};border:0;display:block`,
    allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture',
    // YouTube refuses to play embeds that arrive without a referrer (error 153).
    referrerpolicy: 'strict-origin-when-cross-origin',
    loading: autoplay ? 'eager' : 'lazy',
  });
}

/**
 * Click-to-load player: a local poster and a play control stand in for the
 * third-party player, so nothing is requested from YouTube/Vimeo until a
 * visitor asks for the video.
 */
function embedFacade(item, caption, eager) {
  const button = h(
    'button',
    {
      type: 'button',
      class: 'case__play',
      style: `aspect-ratio:${item.width || 16}/${item.height || 9}`,
      'aria-label': `Play ${item.title || caption || 'video'}${item.duration ? ` (${item.duration})` : ''}`,
    },
    h('img', {
      src: item.poster,
      width: item.width,
      height: item.height,
      alt: '',
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
    }),
    h(
      'span',
      { class: 'case__play-cta mono', 'aria-hidden': 'true' },
      h('span', { class: 'case__play-icon' }),
      'Play',
      item.duration && h('span', { class: 'case__play-time' }, `// ${item.duration}`),
    ),
  );

  button.addEventListener(
    'click',
    () => {
      const frame = embedFrame(item, caption, { autoplay: true });
      button.replaceWith(frame);
      frame.focus();
    },
    { once: true },
  );
  return button;
}
