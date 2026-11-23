import { qs, qsa, reducedMotion } from './lib/dom.js';

const SETTLE_MS = 140;   // quiet time that counts as "scrolling stopped" (no scrollend)
const GIVE_UP_MS = 1400; // a programmatic scroll that never lands is abandoned
const MAX_LOCK_MS = 1600; // input is held off while gliding, never longer than this
const TAIL_MS = 2500;    // after landing, the dying inertia of the same flick is ignored for at most this long…
const TAIL_GAP_MS = 60;  // …only while it keeps streaming (a pause this long means a new gesture)…
const STEADY_PXMS = 1500; // …and only while it keeps fading. Inertia sheds ~1px of delta every (this ÷ delta) ms
                          // (macOS momentum, with margin); a delta that stops falling for longer than that is a
                          // wheel being turned or a hand holding the gesture: the visitor, not momentum.

const NAV_KEYS_DOWN = new Set(['ArrowDown', 'PageDown', ' ']);
const NAV_KEYS_UP = new Set(['ArrowUp', 'PageUp']);

/**
 * Hero ⇄ Selected work, and only that pair.
 *
 * The first wheel tick (or arrow / Page key) in the hero glides straight to the
 * work section, exactly like the yellow arrow, and the rest of the gesture is
 * swallowed while the page moves. Once it lands the page is free immediately: only
 * the fading trackpad inertia of that same flick is ignored, so it can't overshoot,
 * while a fresh swipe or a wheel being turned scrolls on at once. Scrolling up from
 * the top of the work section glides back to the hero the same way. Touch or
 * scrollbar drags that stop halfway through the hero are finished in the direction
 * they were going.
 *
 * Below the top of the work section scrolling is completely free.
 */
export function initSnap(selectors = ['#top', '#work']) {
  const sections = selectors.map((s) => qs(s)).filter(Boolean);
  const nav = qs('.nav');
  if (sections.length < 2) return;

  const root = document.documentElement;
  let lastY = scrollY;
  let target = null;
  let giveUp = 0;
  let locked = false;
  let lockedAt = 0;
  let touching = false;
  let stream = null;    // the wheel gesture a glide swallowed: { dir, floor, since, at, beat }
  let tailUntil = 0;    // after landing, that gesture's inertia is still ignored until then
  let quiet = 0;

  const blocked = () =>
    root.classList.contains('is-booting') || root.matches(':has(.drawer[open])') || qsa('[popover]').some(isOpenPopover);

  /** Scroll positions that put each section's top right under the sticky nav
   *  (clamped: the last section may be shorter than the view). */
  const stops = () => {
    const navH = nav?.offsetHeight ?? 0;
    const max = root.scrollHeight - innerHeight;
    return sections.map((el, i) => (i === 0 ? 0 : Math.min(max, Math.round(el.getBoundingClientRect().top + scrollY - navH))));
  };

  const stopFor = (el) => stops()[sections.indexOf(el)];

  function go(y) {
    target = y;
    clearTimeout(giveUp);
    giveUp = setTimeout(() => {
      target = null;
      release();
    }, GIVE_UP_MS);
    window.scrollTo({ top: y, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  /** One clean glide (arrow, wheel, keys): other input is held off only while it moves. */
  function glide(y) {
    if (Math.abs(scrollY - y) <= 1) return; // already there: nothing to wait for
    locked = true;
    lockedAt = performance.now();
    stream = null;
    tailUntil = 0;
    go(y);
  }

  function release() {
    locked = false;
  }

  /** The glide reached its stop: hand control straight back. */
  function land() {
    target = null;
    clearTimeout(giveUp);
    lastY = Math.round(scrollY);
    if (!locked) return;
    release();
    tailUntil = performance.now() + TAIL_MS;
  }

  /** Follow one wheel gesture: `floor` is its weakest per-frame delta so far, `since`
   *  when that last dropped. Returns false when the event starts a new push instead (a
   *  pause, a reversal, or a clear jump above the floor; rounding jitter of ±1px is not
   *  one). Times are input times, and events a busy main thread delivered merged are
   *  split back into frames, so a hiccup on landing (images decoding) reads as neither. */
  function track(dir, mag, ts) {
    const s = stream;
    const dt = s ? ts - s.at : 0;
    if (s && dir === s.dir && dt <= TAIL_GAP_MS) {
      if (dt > 0) s.beat = Math.min(s.beat || 17, Math.max(7, dt)); // input cadence: 8ms @120Hz, 17ms @60Hz
      const per = mag / Math.max(1, Math.round(dt / (s.beat || 17)));
      if (per <= s.floor * 1.5 + 2) {
        if (per < s.floor) {
          s.floor = per;
          s.since = ts;
        }
        s.at = ts;
        return true;
      }
    }
    stream = { dir, floor: mag, since: ts, at: ts, beat: 0 };
    return false;
  }

  /** Inertia is a fast, same-direction stream that keeps fading. Anything else is the
   *  visitor scrolling again, and ends the tail at once. Weak inertia sits on the same
   *  value longer than strong inertia does, hence the floor-dependent patience. */
  function isTail(dir, mag, ts) {
    if (!stream || ts > tailUntil) return false;
    const patience = Math.min(450, Math.max(40, STEADY_PXMS / Math.max(stream.floor, 1)));
    if (track(dir, mag, ts) && ts - stream.since <= patience) return true;
    stream = null;
    tailUntil = 0;
    return false;
  }

  /* ---- Hero ⇄ first section: one gesture, one glide --------------------- */
  // Which way (if any) an input of `dy` pixels should glide from the current position.
  function heroGlide(dy) {
    const y = scrollY;
    const first = stops()[1];
    if (dy > 0 && y < first - 2) return first;
    if (dy < 0 && y > 2 && y + dy < first - 2) return 0;
    return null;
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || blocked()) return; // pinch-zoom, drawer, popovers
      const now = performance.now();
      // When the input happened (events can sit in a queue while the page is busy).
      const ts = e.timeStamp > 0 && e.timeStamp <= now + 5 && now - e.timeStamp < 1000 ? e.timeStamp : now;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      const dy = e.deltaY * unit;
      const dir = Math.sign(dy);
      const mag = Math.abs(dy);

      if (locked && now - lockedAt > MAX_LOCK_MS) release(); // never trap the wheel
      if (locked) {
        // Mid-glide: the page is already moving, the rest of this gesture is swallowed.
        if (e.cancelable) e.preventDefault();
        track(dir, mag, ts);
        return;
      }
      if (isTail(dir, mag, ts)) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Mid-gesture events can be non-cancelable (the gesture began as a normal
      // scroll): the native scroll can't be stopped, so don't start a glide that it
      // would cut short. settle() finishes the move once that scroll stops.
      if (!e.cancelable) return;

      const to = heroGlide(dy);
      if (to == null) {
        if (target != null) cancel(); // a settle-snap in flight: the visitor takes over
        return;
      }
      e.preventDefault();
      glide(to);
      track(dir, mag, ts);
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || blocked()) return;
    if (e.target.closest?.('input, textarea, select, button, [contenteditable], video, iframe, summary')) return;
    const down = NAV_KEYS_DOWN.has(e.key) && !(e.key === ' ' && e.shiftKey);
    const up = NAV_KEYS_UP.has(e.key) || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    if (locked) return e.preventDefault();
    const to = heroGlide(down ? innerHeight : -innerHeight);
    if (to == null) return cancel();
    e.preventDefault();
    glide(to);
  });

  // The yellow arrow (and any [data-snap-to]) uses the very same glide.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-snap-to]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = qs(link.dataset.snapTo);
    if (!el || !sections.includes(el)) return;
    e.preventDefault();
    glide(stopFor(el));
  });

  /* ---- Touch / scrollbar: never rest halfway through the hero ------------ */
  function settle() {
    const y = Math.round(scrollY);

    if (target != null) {
      // Landing of our own scroll: just record where we are.
      if (Math.abs(y - target) <= 2) return land();
      // Scrolling stopped short of the target: something (a native gesture we
      // couldn't cancel) cut the glide. Pick it back up instead of waiting.
      if (!touching && !blocked()) go(target);
      return;
    }

    if (touching) return; // wait for the finger to lift
    const dir = Math.sign(y - lastY);
    lastY = y;
    if (!dir || blocked()) return;

    const first = stops()[1];
    if (y > 2 && y < first - 2) go(dir > 0 ? first : 0);
  }

  const schedule = () => {
    clearTimeout(quiet);
    quiet = setTimeout(settle, SETTLE_MS);
  };

  // Release the moment the glide arrives, rather than waiting for scrollend.
  window.addEventListener(
    'scroll',
    () => {
      if (target != null && Math.abs(scrollY - target) <= 1) land();
    },
    { passive: true },
  );

  if ('onscrollend' in window) {
    // scrollend already waits for the finger to lift and for any fling to finish.
    window.addEventListener('scrollend', settle);
  } else {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener(
      'touchstart',
      () => {
        touching = true;
        clearTimeout(quiet);
      },
      { passive: true },
    );
    window.addEventListener(
      'touchend',
      () => {
        touching = false;
        schedule(); // a fling keeps firing scroll events, which push this back
      },
      { passive: true },
    );
  }

  // Fresh input cancels a snap in flight, so the visitor stays in control.
  function cancel() {
    if (target == null) return;
    release();
    stream = null;
    tailUntil = 0;
    target = null;
    clearTimeout(giveUp);
    lastY = Math.round(scrollY);
  }
  window.addEventListener('pointerdown', cancel);

  // Jumps from nav links / hashes land exactly on a section; record them as the baseline.
  window.addEventListener('hashchange', () => setTimeout(() => (lastY = Math.round(scrollY)), 900));
}

function isOpenPopover(el) {
  try {
    return el.matches(':popover-open');
  } catch {
    return false;
  }
}
