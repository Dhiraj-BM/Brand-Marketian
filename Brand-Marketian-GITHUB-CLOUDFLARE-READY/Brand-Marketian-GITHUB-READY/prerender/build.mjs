/*
 * Pre-render the Brand Marketian site to static HTML.
 *
 * The pages are authored as a client-side "design canvas" export: each .html is a
 * <x-dc> template hydrated at runtime by support.js, which itself pulls React,
 * ReactDOM and Babel from unpkg.com and compiles the page in the browser. Crawlers
 * (and slow connections) see raw {{ }} placeholders until all of that finishes.
 *
 * This script loads every templated page in headless Chrome, lets the runtime
 * render once, strips the runtime, and writes the resulting static HTML back over
 * the file. The original templates are copied to prerender/src/ first.
 *
 * Re-run after editing a template:  node prerender/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { startServer } from './server.mjs';

const FRONTEND = process.env.BM_FRONTEND ||
  'C:\\Users\\Asus\\Brand-Marketian\\Brand-Marketian-GITHUB-CLOUDFLARE-READY\\Brand-Marketian-GITHUB-READY\\frontend';
const SRC_BACKUP = path.resolve(process.cwd(), 'src'); // prerender/src/
fs.mkdirSync(SRC_BACKUP, { recursive: true });

// every top-level .html that is a client-rendered template (skip the .dc.html partials)
const pages = fs.readdirSync(FRONTEND)
  .filter((f) => f.endsWith('.html') && !f.endsWith('.dc.html'))
  .filter((f) => fs.readFileSync(path.join(FRONTEND, f), 'utf8').includes('<x-dc'));

console.log(`${pages.length} templated pages:`, pages.join(', '));

const { server, port } = await startServer(FRONTEND);
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const strip = () => {
  // runs in the page after render — remove the whole client runtime, keep the DOM it produced
  const kill = [];
  document.querySelectorAll('script').forEach((s) => {
    const src = s.getAttribute('src') || '';
    if (
      s.type === 'text/x-dc' ||
      /(^|\/)support\.js(\?|$)/.test(src) ||
      /_ds_bundle\.js(\?|$)/.test(src) ||
      /(^|\/)home\.js(\?|$)/.test(src) ||          // referenced but never shipped -> 404
      /unpkg\.com\/(react|react-dom|@babel)/.test(src)
    ) kill.push(s);
  });
  kill.forEach((s) => s.remove());

  document.querySelectorAll('template#__bundler_thumbnail, x-dc').forEach((n) => n.remove());
  document.querySelectorAll('style').forEach((st) => {
    if ((st.textContent || '').trim() === 'x-dc{display:none!important}') st.remove();
  });

  // editor-only bookkeeping attributes: strip to keep the file lean
  document.querySelectorAll('[data-dc-tpl]').forEach((el) => el.removeAttribute('data-dc-tpl'));
  document.querySelectorAll('[data-dc-scope]').forEach((el) => el.removeAttribute('data-dc-scope'));

  return {
    text: (document.body.innerText || '').trim().length,
    links: document.querySelectorAll('a[href]').length,
    imgs: document.images.length,
    mustache: (document.body.innerText.match(/\{\{[^}]+\}\}/g) || []).length,
  };
};

const results = [];
for (const file of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1600 });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('brand-marketian-api.onrender.com') || /brandmarketian\.com\/api\//.test(u)) return r.abort();
    r.continue();
  });
  const warnings = [];
  page.on('pageerror', (e) => warnings.push('pageerror: ' + e.message));

  const url = `http://127.0.0.1:${port}/${encodeURIComponent(file)}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  try {
    await page.waitForFunction(() => {
      const x = document.querySelector('x-dc');
      const gone = !x || getComputedStyle(x).display === 'none';
      return gone && !/\{\{[^}]+\}\}/.test(document.body.innerText || '');
    }, { timeout: 45000, polling: 400 });
  } catch (e) {
    warnings.push('render-wait: ' + e.message);
  }
  await new Promise((r) => setTimeout(r, 1200));

  const stats = await page.evaluate(strip);
  let html = await page.content();
  html = '<!DOCTYPE html>\n<!-- Pre-rendered static HTML. Edit the template in /prerender/src/' + file +
         ' then run: node prerender/build.mjs -->\n' + html.replace(/^<!DOCTYPE html>\s*/i, '');

  // back up the original template once
  const backup = path.join(SRC_BACKUP, file);
  if (!fs.existsSync(backup)) fs.copyFileSync(path.join(FRONTEND, file), backup);
  fs.writeFileSync(path.join(FRONTEND, file), html);

  results.push({ file, ...stats, bytes: Buffer.byteLength(html), warnings });
  console.log(
    `${file.padEnd(34)} text:${String(stats.text).padStart(6)}  links:${String(stats.links).padStart(3)}` +
    `  imgs:${String(stats.imgs).padStart(2)}  {{}}:${stats.mustache}` +
    (warnings.length ? `  ⚠ ${warnings.length}` : '')
  );
  await page.close();
}

await browser.close();
server.close();

const bad = results.filter((r) => r.mustache > 0 || r.text < 400);
console.log('\n' + '='.repeat(60));
console.log(`done: ${results.length} pages, ${bad.length} suspicious`);
if (bad.length) console.log('CHECK:', bad.map((b) => b.file).join(', '));
results.forEach((r) => r.warnings.forEach((w) => console.log(`  ${r.file}: ${w}`)));
fs.writeFileSync(path.join(process.cwd(), 'build-report.json'), JSON.stringify(results, null, 2));
