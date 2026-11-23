import { qsa, pad } from './lib/dom.js';

/** Push profile values from projects.json into the static markup. */
export function hydrateProfile(profile, { projects }) {
  const contact = profile.contact ?? {};
  const set = (sel, value) => value != null && qsa(sel).forEach((el) => (el.textContent = value));

  set('[data-profile="experience"]', `${profile.experienceYears}+`);
  set('[data-profile="experienceYears"]', profile.experienceYears);
  set('[data-profile="availability"]', profile.availability);
  set('[data-profile="email"]', contact.email);
  set('[data-stat="cases"]', pad(projects.length));
  set('[data-year]', new Date().getFullYear());

  qsa('.specs__num').forEach((el) => el.setAttribute('aria-label', `${profile.experienceYears} plus years`));

  if (contact.email) qsa('[data-profile-mailto]').forEach((a) => (a.href = `mailto:${contact.email}`));

  // Social channels: hide the cell entirely if the URL is missing.
  qsa('[data-profile-href]').forEach((a) => {
    const url = contact[a.dataset.profileHref];
    if (url) a.href = url;
    else a.closest('li')?.remove();
  });
}

/** Any [data-cmd="copy-email"] button copies the address and reports back. */
export function bindCopyEmail(email, bus) {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cmd="copy-email"]');
    if (!btn || !email) return;

    const ok = await copyText(email);
    const label = btn.querySelector('[data-copy-label]');
    const original = label?.dataset.original ?? label?.textContent;
    if (label) {
      label.dataset.original = original;
      label.textContent = ok ? 'Copied' : email;
    }
    btn.classList.add('is-done');
    setTimeout(() => {
      if (label) label.textContent = original;
      btn.classList.remove('is-done');
    }, 2200);

    bus.emit('hud:say', {
      text: ok ? `Clipboard >> ${email} // Paste to transmit` : `Clipboard blocked // Address: ${email}`,
      state: ok ? 'tx' : 'err',
    });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
