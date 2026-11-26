# davidmunoz.ca — static portfolio

Zero-dependency, self-hosted portfolio: semantic HTML, CSS Grid with custom properties,
and native ES modules. There's no build step, no framework and no third-party requests at
runtime (all fonts are self-hosted).

**Design direction:** minimal cyberpunk with a Japanese layer, laid out with a lot of
negative space (after Nathan Bolger's *Lab.®* UI). A navy `#111827` canvas, white ink and
one yellow accent per screen. Each screen has one subject and a few small labels:
- the hero is the android in front of a giant yellow DM mark, a two-line title, dashed
  labels and a yellow corner square with an arrow;
- sections open with a dashed label and a big statement whose accent line leads with a
  rule (`SELECTED / — CASE FILES`).

The previous dense HUD version is archived in `_archive/2026-11-19-dense-hud/`.

## Run it locally

```sh
python3 tools/serve.py          # → http://localhost:8080
```

Browsers block `fetch()` from `file://`, so the page must be served over HTTP.
`tools/serve.py` is the standard-library server with a deeper connection queue.
Plain `python3 -m http.server` can drop parallel ES-module requests on macOS.

To see the boot sequence again, open a new tab; it runs once per browser session.

## Deploy

Upload the folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, S3, or
cPanel). Skip `_archive/`, `tools/` and the source art in `assets/` (`android.png`,
`header4.png`). The site uses the optimised copies in `assets/img/` and the two
`assets/*.mp4` loops.

## Structure

```
index.html              shell: boot overlay, nav, hero, archive, specs, contact, drawer
data/projects.json      ← single source of truth: profile, filters, capabilities, projects
css/
  tokens.css            palette + tints, fonts (@font-face), type scale, motion
  base.css              reset, focus rings, reduced motion, .mono / .jp / .jp-display
  layout.css            nav, hero geometry (container-query units), section heads, specs, contact
  components.css        label/statement/corner-arrow atoms, popovers, filters, tiles, capabilities, drawer, boot
js/
  main.js               bootstrap + routing glue
  boot.js               first-visit boot sequence (skippable, off under reduced motion)
  data.js               fetch + normalise projects.json
  router.js             #/work/<slug> hash routing
  snap.js               hero ⇄ selected work in one glide (wheel, keys, arrow); free scroll below
  grid.js               archive tiles: 7/5 · 5/7 · 4/4/4 rhythm, filters, EOF card
  drawer.js             case-file slide-over (<dialog>, prev/next, ←/→, Esc)
  hud.js                mascot voice in the helmet popover, hero feed dots (lens video), parallax, menu
  specs.js              profile facts + capability index (derived from data)
  profile.js            contact hydration + copy-email
  clock.js              live Toronto time
  lib/                  dom helper, event bus, shared UI atoms
tools/
  serve.py              local preview server
  subset_jp.py          re-subsets the Japanese fonts to the glyphs actually used
assets/
  fonts/                Saira (var), JetBrains Mono (var), Dela Gothic One + Zen Kaku Gothic New (JP subsets)
  img/work/<slug>/      cover.jpg + gallery frames
demos/<slug>/           self-contained interactive demos, loaded click-to-open in the drawer via "hero"
  img/mascot/           hero cutout, helmet illustrations, video posters
```

## Typography

| Role | Face | Why |
| --- | --- | --- |
| Display + text | **Saira** (variable: width 50–125, weight 100–900) | Display runs at weight 500, normal width, tight tracking (`--display-*` tokens): airy, while the squared counters still echo the DM mark. |
| Telemetry | **JetBrains Mono** | Indices, coordinates, timestamps. |
| Japanese display | **Dela Gothic One** | Blocky cuts that sit well beside the logo (経験値). |
| Japanese labels | **Zen Kaku Gothic New 700** | Small bilingual labels (作品 · 仕様 · 連絡). |

The display face is one token (`--font-sans` in `css/tokens.css`); swap it there.

**Adding Japanese text?** Run `python3 tools/subset_jp.py` afterwards. It scans
`index.html`, `js/` and `data/` and rebuilds both Japanese font files (~12 KB each).
Characters missing from the subset fall back to the system font.

## Routes

| URL | Result |
| --- | --- |
| `/#/work/<slug>` | Opens that case file in the drawer (shareable deep link) |
| `/#work`, `#specs`, `#contact` | Native anchor scroll (works without JS) |

## Add or edit a project

Append an object to `projects` in `data/projects.json`. The archive, filter counts,
capability index, drawer and HUD telemetry all update automatically.

```jsonc
{
  "slug": "new-client",                 // URL: #/work/new-client
  "title": "New Client",
  "client": "New Client Inc.",
  "category": "Brand System",           // yellow badge text
  "disciplines": ["brand"],             // brand | digital | motion | editorial
  "tags": ["packaging"],                // optional, feeds the Packaging capability
  "year": "2026",                       // shown on the tile and in the drawer
  "sector": "Retail",
  "status": "published",                // or "draft" → no-signal placeholder
  "summary": "One line for the tile.",
  "overview": "Lede paragraph in the drawer.",
  "challenge": "…",
  "solution": "…",
  "deliverables": ["Logo", "Packaging"],
  "cover":   { "src": "assets/img/work/new-client/cover.jpg", "width": 960, "height": 720, "alt": "…" },
  // optional: a reel shown as the drawer's key visual instead of the cover (the tile keeps the cover).
  // With a "poster", embeds are click-to-play: nothing loads from YouTube/Vimeo until a visitor asks.
  "hero":    { "type": "embed", "src": "https://www.youtube-nocookie.com/embed/ID?rel=0", "poster": "…/poster.jpg",
               "width": 1280, "height": 720, "duration": "01:47", "title": "Reel", "caption": "Motion reel" },
  "gallery": [
    { "type": "image", "src": "…/01.jpg", "width": 1800, "height": 1200, "alt": "…", "caption": "…" },
    { "type": "video", "src": "…/reel.mp4", "poster": "…/reel.jpg", "width": 1920, "height": 1080 },
    { "type": "embed", "src": "https://player.vimeo.com/video/ID", "width": 1920, "height": 1080, "title": "Reel" }
  ]
}
```

Tile order = array order. The 7/5 · 5/7 · 4/4/4 rhythm is applied to whatever is
visible, and an "EOF" card closes an incomplete last row. Set `"hidden": true` to pull a
project without deleting it.

## Before going live

- [x] `profile.contact` in `projects.json`: real email, LinkedIn and Instagram URLs
      (a missing URL hides its link).
- [ ] Optional: compress the HUD loops (each `assets/*.mp4` is ~5.5 MB and loads only
      when a visitor picks CH.02/CH.03), e.g.
      `ffmpeg -i videome5.mp4 -an -vf scale=540:-2 -c:v libx264 -crf 28 -movflags +faststart mascot-loop-a.mp4`

## Design-system rules

- Colours: only `#111827`, `#FFC61A` and `#FFFFFF`. Tints are `color-mix()` of those three.
  Use the role tokens, not the literals: `--bg` (navy canvas), `--fg` (white ink),
  `--fg-70/40/30/12/05` tints, `--on-signal` (navy text on yellow).
  Add `.theme-signal` to a section to flip it to a yellow panel (navy ink, navy accents);
  the contact section uses it.
  Yellow is never small text on white; it's a fill, a square marker or giant display art.
  Keep it to one accent per screen.
- Fewer elements: one subject per screen, small dashed labels (`.label`), big statements
  (`.statement`), hairlines instead of boxes. The yellow square with an arrow
  (`.corner-arrow`) is the only "go" control.
- 0 px corners, no shadows. Circles appear only as optics (reticle, lens) and the
  end-of-archive disc.
- Hover reveals colour on archive images, slides in the yellow arrow square and runs the
  stroke-n-fill cut on the title.
- Every animation is disabled under `prefers-reduced-motion`, which also skips the boot.
