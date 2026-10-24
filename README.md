# Full Spectrum Deep Formulator

A web app for formulating with Full Spectrum Deep™: natural level, desired level and reflective tone in; Natural Series shade, controlling base, Pure Tone grams, Color Catalyst™ and processing out, with the Botanical Repair™ color treatment, a predicted result swatch and a step-by-step walkthrough of how the formula was built. Installable on a phone and works offline.

## Sources

Full Spectrum Deep™ Systems training deck (GLOBAL, 10.1.26), the Participant Leaflet (8/2026) and the Aveda Hair Color Professional Reference Guide (9.12.25). House rules that go beyond the printed material are documented in `tests/formulate.test.js`, which is the authoritative statement of the logic.

Live: https://axlndr.github.io/FSD-Formulator/

## Layout

- `src/data.js` — the formulation chart, Pure Tone amounts, NRP tables, tone families, the color wheel positions and the named tonal recipes.
- `src/formulate.js` — the formulation logic as a pure function (`formulate(inputs)` → result). No page code, so it can be tested on its own.
- `src/ui.js` — the page: inputs, tone picker, color wheel, result rendering.
- `src/index.html`, `src/styles.css`, `src/fonts.css` — markup, styles and embedded fonts.
- `src/sw.js`, `src/manifest.webmanifest`, `src/icons/` — the installable/offline layer.
- `tests/formulate.test.js` — the formulation rules as tests, including the training deck's worked scenarios.
- `scripts/build.js` — produces `dist/`: one self-contained `index.html` plus the PWA files.

## Working on it

```
npm test        # run the formulation tests
npm run build   # build dist/
npm start       # serve src/ locally for development
```

Every push to `main` runs the tests, builds, and deploys `dist/` to GitHub Pages. A failing test blocks the deploy.
