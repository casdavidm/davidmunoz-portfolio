import { qs, qsa, pad, reducedMotion } from './lib/dom.js';
import { mediaReadout } from './data.js';

const STATE_WORDS = { idle: 'Online', scan: 'Scanning', tx: 'Transmit', err: 'Fault' };
const TYPE_MS = 16;      // per 2 characters
const IDLE_MS = 7000;    // idle chatter cadence
const RELEASE_MS = 1400; // grace period after the pointer leaves the archive
const SETTLE_MS = 2600;  // tx → idle

const supportsPopover = Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');

/**
 * Mascot HUD. One voice: the command popover behind the helmet tab in the nav
 * (an optional nav toast still works if the markup provides one).
 * Listens on the bus; never touches other modules directly.
 */
export function createHud({ data, bus }) {
  const hero = qs('.hero');
  const stage = qs('[data-hero-stage]');
  const mini = qs('#hud-mini');
  const menu = qs('#menu');
  const trigger = qs('[data-hud-trigger]');
  const toast = qs('[data-nav-toast]');
  const coords = qs('[data-hud-coords]');
  const msgId = qs('[data-hud-msgid]');
  const lock = qs('[data-hud-lock]');
  const feed = qs('[data-hud-feed]');
  const textTargets = qsa('[data-hud-text]');
  const stateTargets = qsa('[data-hud-state]');
  const stateHosts = [hero, mini, trigger, toast];
  const channelButtons = qsa('.chan');

  const total = data?.projects.length ?? 0;
  const years = data?.profile?.experienceYears ?? 14;
  const idleLines = [
    `Systems nominal // ${pad(total)} case files indexed`,
    'Scroll to the archive to run a scan',
    'Loc 43.6532°N 79.3832°W // Toronto, ON',
    `${years}+ yrs of brand ops logged`,
    'Status: accepting freelance briefs',
    'Palette lock: #111827 / #FFC61A / #FFFFFF',
  ];

  let state = 'idle';
  let msgCount = 0;
  let idleIndex = 0;
  let typeTimer = 0;
  let releaseTimer = 0;
  let settleTimer = 0;
  let toastTimer = 0;
  let heroVisible = true;
  let video = null;

  /* ---- Voice ---------------------------------------------------------- */
  const write = (text) => textTargets.forEach((el) => (el.textContent = text));

  function setState(next) {
    state = next;
    stateHosts.forEach((el) => el && (el.dataset.state = next));
    stateTargets.forEach((el) => (el.textContent = STATE_WORDS[next] ?? next));
  }

  function say(text, nextState = state) {
    setState(nextState);
    msgCount += 1;
    if (msgId) msgId.textContent = `MSG.${pad(msgCount, 3)}`;

    clearInterval(typeTimer);
    const full = String(text).toUpperCase();
    if (reducedMotion.matches) return write(full);

    let i = 0;
    typeTimer = setInterval(() => {
      i = Math.min(full.length, i + 2);
      write(full.slice(0, i));
      if (i >= full.length) clearInterval(typeTimer);
    }, TYPE_MS);
  }

  function transmit(text, nextState = 'tx') {
    clearTimeout(settleTimer);
    say(text, nextState);
    flashToast(SETTLE_MS);
    settleTimer = setTimeout(() => {
      if (state === 'tx' || state === 'err') setState('idle');
    }, SETTLE_MS);
  }

  /** The toast only speaks while the hero unit is off-screen. */
  function flashToast(ms) {
    clearTimeout(toastTimer);
    if (heroVisible) return toast?.classList.remove('is-visible');
    toast?.classList.add('is-visible');
    if (ms) toastTimer = setTimeout(() => toast?.classList.remove('is-visible'), ms);
  }

  /* ---- Project telemetry ---------------------------------------------- */
  bus.on('project:hover', (p) => {
    if (!p) return;
    clearTimeout(releaseTimer);
    clearTimeout(settleTimer);
    if (lock) lock.textContent = `Lock // ${p.code}`;
    say(
      p.isDraft
        ? `Scan >> ${p.title} // ${p.category} // No signal: file incoming`
        : `Scan >> ${p.title} // ${p.category} // ${p.year} // ${mediaReadout(p)}`,
      'scan',
    );
    // Auto-hide as a safety net: scrolling under a still pointer may never fire a leave.
    flashToast(5000);
  });

  bus.on('project:leave', () => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      say('Standing by // Select a file to open', 'idle');
      toast?.classList.remove('is-visible');
    }, RELEASE_MS);
  });

  bus.on('grid:filter', ({ filter, count, initial }) => {
    if (initial) return;
    transmit(`Filter engaged >> ${filter.label} // ${pad(count)} ${count === 1 ? 'match' : 'matches'}`);
  });

  bus.on('case:open', (p) => {
    clearTimeout(releaseTimer);
    toast?.classList.remove('is-visible');
    say(`Case file ${p.code} open >> ${p.title}`, 'tx');
  });

  bus.on('case:close', () => say('Case file closed // Standing by', 'idle'));
  bus.on('hud:say', ({ text, state: s = 'tx' }) => transmit(text, s));

  /* ---- Idle chatter ---------------------------------------------------- */
  const isOpen = (el) => {
    try {
      return supportsPopover ? el.matches(':popover-open') : !el.hidden;
    } catch {
      return false;
    }
  };

  setInterval(() => {
    if (state !== 'idle' || document.hidden || !(heroVisible || isOpen(mini))) return;
    say(idleLines[idleIndex++ % idleLines.length], 'idle');
  }, IDLE_MS);

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    if (heroVisible) toast?.classList.remove('is-visible');
    if (!video) return;
    if (heroVisible && hero.dataset.channel !== 'still' && !reducedMotion.matches) video.play().catch(() => {});
    else video.pause();
  }, { threshold: 0.15 }).observe(hero);

  /* ---- Pointer telemetry: coords + parallax ---------------------------- */
  let raf = 0;
  let mx = 0.5;
  let my = 0.5;

  const paint = () => {
    raf = 0;
    stage.style.setProperty('--mx', mx.toFixed(3));
    stage.style.setProperty('--my', my.toFixed(3));
    if (coords) coords.textContent = `X:${pad(Math.round(mx * 999), 3)} Y:${pad(Math.round(my * 999), 3)}`;
  };

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    mx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    my = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    raf ||= requestAnimationFrame(paint);
  });

  hero.addEventListener('pointerleave', () => {
    mx = my = 0.5;
    raf ||= requestAnimationFrame(paint);
  });

  /* ---- Feed channels: CH.02/03 open a circular lens on the helmet ------- */
  channelButtons.forEach((btn) => btn.addEventListener('click', () => setChannel(btn)));

  function setChannel(btn) {
    const id = btn.dataset.channel;
    channelButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    hero.dataset.channel = id;
    const ch = btn.textContent.trim();

    if (id === 'still') {
      feed.hidden = true;
      video?.pause();
      transmit(`${ch} // Still frame locked`);
      return;
    }

    if (!video) {
      video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      feed.append(video);
    }

    if (video.dataset.src !== btn.dataset.src) {
      video.poster = btn.dataset.poster || '';
      video.src = btn.dataset.src;
      video.dataset.src = btn.dataset.src;
    }

    feed.hidden = false;
    video.controls = reducedMotion.matches;
    if (!reducedMotion.matches) video.play().catch(() => {});
    transmit(`${ch} // Lens feed engaged`);
  }

  /* ---- Popovers: command HUD + mobile menu ------------------------------ */
  const position = () => {
    const r = trigger.getBoundingClientRect();
    mini.style.setProperty('--mini-top', `${Math.round(r.bottom + 12)}px`);
    mini.style.setProperty('--mini-right', `${Math.max(16, Math.round(document.documentElement.clientWidth - r.right))}px`);
  };

  wirePopover(mini, trigger, (open) => {
    trigger.classList.toggle('is-open', open);
    if (open) {
      position();
      toast?.classList.remove('is-visible');
      window.addEventListener('resize', position);
    } else {
      window.removeEventListener('resize', position);
    }
  });

  wirePopover(menu, qs('[data-menu-trigger]'));

  // Any in-popover navigation closes its popover.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-cmd="nav"]');
    if (!link) return;
    const pop = link.closest('[popover]');
    if (pop) hidePopover(pop);
  });

  return { say: transmit };
}

/* Popover API with a plain-disclosure fallback for older engines. */
function wirePopover(el, trigger, onToggle = () => {}) {
  if (!el || !trigger) return;
  if (supportsPopover) {
    el.addEventListener('toggle', (e) => onToggle(e.newState === 'open'));
    return;
  }
  const set = (open) => {
    el.hidden = !open;
    el.classList.toggle('is-fallback-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    onToggle(open);
  };
  set(false);
  trigger.setAttribute('aria-controls', el.id);
  trigger.addEventListener('click', () => set(el.hidden));
  el.querySelectorAll('[popovertargetaction="hide"]').forEach((b) => b.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
  el._fallbackSet = set;
}

function hidePopover(el) {
  if (supportsPopover) {
    try {
      el.hidePopover();
    } catch {
      /* already closed */
    }
  } else {
    el._fallbackSet?.(false);
  }
}
