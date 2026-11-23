import { qsa } from './lib/dom.js';

/** Live local-time telemetry for every [data-clock] / [data-clock-zone]. */
export function startClock(timeZone = 'America/Toronto') {
  const clocks = qsa('[data-clock]');
  const zones = qsa('[data-clock-zone]');

  let timeFmt;
  let zoneFmt;
  try {
    timeFmt = new Intl.DateTimeFormat('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    zoneFmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' });
  } catch {
    return startClock('America/Toronto');
  }

  const tick = () => {
    const now = new Date();
    const time = timeFmt.format(now);
    const zone = zoneFmt.formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? '';
    for (const el of clocks) {
      el.textContent = time;
      if (el instanceof HTMLTimeElement) el.dateTime = now.toISOString();
    }
    for (const el of zones) el.textContent = zone;
  };

  tick();
  // Align ticks to the wall-clock second.
  setTimeout(() => {
    tick();
    setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));
}
