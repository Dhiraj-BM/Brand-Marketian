/*
 * Ping IndexNow (Bing, Yandex, Naver, Seznam — and, downstream, ChatGPT Search)
 * with every URL in the sitemap. Run after a deploy:
 *
 *   node scripts/indexnow.mjs
 *
 * The key file must be live at:
 *   https://brandmarketian.com/9085931357aa70cd12f18224634a9f24.txt
 *
 * Google does NOT use IndexNow — for Google, keep the sitemap fresh and let
 * Search Console re-read it (Indexing > Sitemaps), or use URL Inspection >
 * Request Indexing for a specific page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'brandmarketian.com';
const KEY = '9085931357aa70cd12f18224634a9f24';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = fs.readFileSync(path.join(root, 'frontend', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (!urlList.length) {
  console.error('No <loc> entries found in frontend/sitemap.xml');
  process.exit(1);
}

const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList,
};

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs`);
console.log(await res.text().catch(() => ''));
// 200 or 202 = accepted. 422 = key/host mismatch. 403 = key not found at keyLocation.
process.exit(res.ok ? 0 : 1);
