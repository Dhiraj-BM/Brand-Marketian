// Mobile QA: loads every sitemap page at iPhone size, reports elements that
// spill past the screen edge, opens the hamburger menu, and saves screenshots.
//   node mobile-audit.mjs [baseUrl] [outDir]
// baseUrl defaults to https://brandmarketian.com (use http://localhost:8765 to
// test local changes: `python -m http.server 8765` in ../frontend).
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || 'https://brandmarketian.com').replace(/\/$/, '');
const OUT = process.argv[3] || path.resolve('mobile-audit-out');
const local = !/brandmarketian\.com/.test(BASE);
fs.mkdirSync(OUT, { recursive: true });

const sitemap = fs.readFileSync(path.resolve('../frontend/sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https:\/\/brandmarketian\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/');
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const browser = await puppeteer.launch({ headless: true });
const report = [];
for (const p of pages) {
  if (only && !only.includes(p === '/' ? 'home' : p.slice(1))) continue;
  const url = BASE + (local && p !== '/' ? p + '.html' : p);
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  } catch (e) { report.push({ p, error: String(e.message).slice(0, 120) }); await page.close(); continue; }
  await new Promise((r) => setTimeout(r, 1500));
  // reveal scroll-animated content so screenshots show the real layout
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); }
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 600));
  const info = await page.evaluate(() => {
    const vw = window.innerWidth;
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return a.getBoundingClientRect().right <= vw + 1;
      }
      return false;
    };
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none' || s.position === 'fixed') continue;
      if ((r.right > vw + 2 || r.left < -2) && !clipped(el)) {
        out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent || '').trim().slice(0, 40)}"`);
      }
    }
    // smallest tap targets / tiny text
    const tiny = [...document.querySelectorAll('p,li,a,span,td')].filter((e) => {
      const fs = parseFloat(getComputedStyle(e).fontSize); return e.offsetParent && fs < 11 && (e.textContent || '').trim().length > 3;
    }).length;
    return { vw, winScroll: document.scrollingElement.scrollHeight > window.innerHeight + 50, docW: document.documentElement.scrollWidth, overflow: out.slice(0, 12), overflowCount: out.length, tinyText: tiny, h: document.body.scrollHeight };
  });
  const name = (p === '/' ? 'home' : p.replace(/^\//, '').replace(/\//g, '_'));
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 55, fullPage: true });
  // header over light content (scrolled well past the hero)
  await page.evaluate(() => window.scrollTo(0, 1400));
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(OUT, `${name}__scrolled.jpg`), type: 'jpeg', quality: 60 });
  let menu = null;
  if (await page.$('.bm-hamburger')) {
    await page.click('.bm-hamburger');
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: path.join(OUT, `${name}__menu.jpg`), type: 'jpeg', quality: 60 });
    menu = await page.evaluate(() => {
      const m = document.querySelector('.bm-mobile-menu'); const a = m && m.querySelector('a');
      const cs = (e) => e && getComputedStyle(e);
      return m ? { bg: cs(m).backgroundColor, link: cs(a).color, opacity: cs(m).opacity } : 'no panel';
    });
  } else menu = 'NO HAMBURGER';
  report.push({ p, ...info, menu });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`${r.p}  winScroll=${r.winScroll} docW=${r.docW} overflow=${r.overflowCount} tiny=${r.tinyText} menu=${JSON.stringify(r.menu)}${r.error ? ' ERROR ' + r.error : ''}`);
  (r.overflow || []).slice(0, 4).forEach((o) => console.log('    ' + o));
}
