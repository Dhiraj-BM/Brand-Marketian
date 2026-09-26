// Crawlability check for search engines and AI crawlers.
//   node scripts/crawl-check.mjs [baseUrl]
// For every sitemap URL, fetched as Googlebot / GPTBot / ClaudeBot /
// PerplexityBot: status (must be 200, no redirect), noindex (meta or header),
// canonical must equal the URL, one <h1>, a <title>. Also checks every
// internal link found on those pages resolves, and prints robots.txt rules.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'https://brandmarketian.com').replace(/\/$/, '');
const sitemap = fs.readFileSync(path.join(ROOT, 'frontend/sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !/\.(jpg|webp|png)$/.test(u));

const BOTS = {
  Googlebot: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  ClaudeBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'
};

const get = (u, ua, redirect = 'manual') => fetch(u, { headers: { 'User-Agent': ua }, redirect });
const problems = [];
const links = new Set();

for (const u of urls) {
  const url = u.replace('https://brandmarketian.com', BASE);
  for (const [bot, ua] of Object.entries(BOTS)) {
    const r = await get(url, ua);
    if (r.status !== 200) { problems.push(`${bot} ${r.status} ${url}${r.headers.get('location') ? ' -> ' + r.headers.get('location') : ''}`); continue; }
    const xr = r.headers.get('x-robots-tag') || '';
    if (/noindex/i.test(xr)) problems.push(`${bot} X-Robots-Tag noindex ${url}`);
    if (bot !== 'Googlebot') continue;
    const html = await r.text();
    const robots = (html.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || '';
    const canon = (html.match(/<link rel="canonical" href="([^"]*)"/i) || [])[1] || '';
    const h1 = (html.match(/<h1[\s>]/gi) || []).length;
    const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '';
    if (/noindex/i.test(robots)) problems.push(`meta noindex ${url}`);
    if (canon !== u) problems.push(`canonical mismatch ${u} -> ${canon || '(none)'}`);
    if (h1 !== 1) problems.push(`h1 count ${h1} ${url}`);
    if (!title) problems.push(`no <title> ${url}`);
    for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"/gi)) {
      const h = m[1];
      if (/^(mailto:|tel:|javascript:|https?:\/\/(?!brandmarketian\.com))/i.test(h)) continue;
      links.add(new URL(h, u).href.split('#')[0]);
    }
  }
}

// Every internal link must land on a 200 (after at most one redirect hop).
for (const l of links) {
  const url = l.replace('https://brandmarketian.com', BASE);
  const r = await get(url, BOTS.Googlebot);
  if (r.status === 200) continue;
  if (r.status >= 300 && r.status < 400) {
    const to = new URL(r.headers.get('location'), url).href;
    const r2 = await get(to, BOTS.Googlebot);
    if (r2.status !== 200) problems.push(`link ${l} -> ${to} -> ${r2.status}`);
    else problems.push(`link redirects (ok but prefer direct) ${l} -> ${to}`);
  } else problems.push(`BROKEN link ${r.status} ${l}`);
}

const robotsTxt = await (await get(BASE + '/robots.txt', BOTS.Googlebot)).text();
console.log(`checked ${urls.length} sitemap URLs x ${Object.keys(BOTS).length} bots, ${links.size} internal links`);
console.log(problems.length ? problems.join('\n') : 'no problems');
console.log('--- robots.txt ---\n' + robotsTxt.trim());
