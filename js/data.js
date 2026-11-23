import { pad } from './lib/dom.js';

const DATA_URL = new URL('../data/projects.json', import.meta.url);

/** Fetch + normalise projects.json into the shape every module consumes. */
export async function loadData() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${DATA_URL.pathname}`);
  return normalize(await res.json());
}

function normalize(raw) {
  if (!Array.isArray(raw?.projects)) throw new Error('projects.json is missing a "projects" array');

  const labels = new Map((raw.disciplines ?? []).map((d) => [d.id, d.label]));
  const jpLabels = new Map((raw.disciplines ?? []).map((d) => [d.id, d.jp ?? '']));
  const seen = new Set();

  const projects = raw.projects
    .filter((p) => p.hidden !== true)
    .map((p, i) => {
      if (seen.has(p.slug)) console.warn(`[projects.json] duplicate slug "${p.slug}"`);
      seen.add(p.slug);

      return {
        ...p,
        index: i + 1,
        code: pad(i + 1),
        isDraft: p.status === 'draft',
        disciplines: p.disciplines ?? [],
        disciplineLabels: (p.disciplines ?? []).map((id) => labels.get(id) ?? id),
        disciplineJp: (p.disciplines ?? []).map((id) => jpLabels.get(id)).filter(Boolean),
        latestYear: Math.max(0, ...String(p.year ?? '').match(/\d{4}/g)?.map(Number) ?? [0]),
        tags: p.tags ?? [],
        deliverables: p.deliverables ?? [],
        gallery: p.gallery ?? [],
        cover: p.cover ?? null,
        hero: p.hero ?? null, // optional video/embed shown in the drawer in place of the cover
        monogram: p.monogram || initials(p.title),
      };
    });

  return {
    profile: raw.profile,
    disciplines: raw.disciplines ?? [],
    filters: raw.filters?.length ? raw.filters : [{ id: 'all', label: 'All', match: [] }],
    capabilities: raw.capabilities ?? [],
    projects,
    bySlug: new Map(projects.map((p) => [p.slug, p])),
    updated: raw.updated,
  };
}

const initials = (title = '') =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

const hits = (project, { match = [], matchTags = [] }) =>
  match.some((d) => project.disciplines.includes(d)) || matchTags.some((t) => project.tags.includes(t));

/** Filters: an empty `match` list means "everything" ([ALL]). */
export const matchesFilter = (project, filter) =>
  !filter.match?.length && !filter.matchTags?.length ? true : hits(project, filter);

/** Capabilities: an empty `match` list means "no linked case files" (service only). */
export const matchesCapability = (project, capability) => hits(project, capability);

/** Media frame count shown in telemetry (key visual + gallery). */
export const frameCount = (project) => project.gallery.length + (project.hero || project.cover ? 1 : 0);

/** Telemetry readout: running time for reels, frame count for everything else. */
export const mediaReadout = (project) =>
  project.hero?.duration ? `RT ${project.hero.duration}` : `${pad(frameCount(project))} frames`;
