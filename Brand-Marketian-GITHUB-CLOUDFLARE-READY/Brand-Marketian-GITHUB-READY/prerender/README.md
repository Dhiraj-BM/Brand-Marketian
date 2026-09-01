# Pre-render toolkit

The pages under `../frontend/` are shipped as **static HTML**. They were authored
as a client-side "design canvas" export (`<x-dc>` templates hydrated at runtime by
`support.js`, which pulled React + ReactDOM + Babel from unpkg.com and compiled the
page in the browser). That left crawlers looking at raw `{{ }}` placeholders.

`build.mjs` loads each template in headless Chrome, lets the runtime render once,
strips the runtime, and writes the resulting static HTML back over the file in
`../frontend/`. The **original templates live in `src/`** — edit those, not the
built files.

## Rebuild after a content change

```bash
cd prerender
npm install            # one-time: installs puppeteer (bundled Chromium)
# edit prerender/src/<page>.html
node build.mjs
```

Then commit the changed files in `../frontend/`.

## Notes

- Dynamic text still works: `cms.js` is kept and continues to override any
  `[data-cms]` element from the CMS API after load.
- What was lost with the runtime: hero-carousel auto-rotate, the testimonial
  prev/next slider, and CSS `style-hover` effects. Re-add as small vanilla JS in
  a page-level script if wanted.
- `build.mjs` blocks requests to the Render API during the build so authored copy
  is what gets baked in.
