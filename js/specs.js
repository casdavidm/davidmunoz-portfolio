import { h, qs, pad } from './lib/dom.js';
import { matchesCapability } from './data.js';

/** Specs: a few profile facts and the capability index, both from projects.json. */
export function renderSpecs({ profile, capabilities, projects, updated }) {
  renderFacts(profile);
  renderCaps(capabilities, projects);

  if (updated) {
    const rev = qs('[data-rev]');
    if (rev) rev.textContent = updated.slice(0, 7).replace('-', '.');
  }
}

/* ---- Facts: four short label/value pairs ---------------------------------- */
function renderFacts(profile) {
  const loc = profile.location ?? {};
  const rows = [
    ['Role', profile.role],
    ['Base', [loc.city, loc.region, loc.country].filter(Boolean).join(', ')],
    ['Education', profile.education?.map((e) => h('span', { class: 'facts__line' }, e.label, h('small', {}, e.school)))],
    ['Languages', profile.languages?.join(' / ')],
  ].filter(([, value]) => value != null && value !== '' && !(Array.isArray(value) && !value.length));

  qs('[data-facts]')?.replaceChildren(
    ...rows.map(([label, value]) => h('div', {}, h('dt', { class: 'mono' }, label), h('dd', {}, value))),
  );
}

/* ---- Capability index: name, scope, linked case files, count -------------- */
function renderCaps(capabilities, projects) {
  qs('[data-caps]')?.replaceChildren(
    ...capabilities.map((cap, i) => {
      const refs = projects.filter((p) => matchesCapability(p, cap));
      return h(
        'li',
        { class: 'cap' },
        h('span', { class: 'cap__idx mono', 'aria-hidden': 'true' }, pad(i + 1)),
        h(
          'div',
          { class: 'cap__body' },
          h('h4', { class: 'cap__name' }, cap.label),
          h('p', { class: 'cap__scope' }, cap.scope),
          refs.length
            ? h(
                'p',
                { class: 'cap__refs mono' },
                refs.flatMap((p, k) => [k ? ' / ' : null, h('a', { href: `#/work/${p.slug}` }, p.title)]),
              )
            : h('p', { class: 'cap__refs mono' }, 'On request'),
        ),
        h('span', { class: 'cap__qty', 'aria-label': `${refs.length} case files` }, refs.length ? pad(refs.length) : '—'),
      );
    }),
  );
}
