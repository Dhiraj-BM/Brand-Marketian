// Applies scripts/blog-images.json to every blog article and to the blog
// listing, in both prerender/src (templates) and frontend (built pages):
//   - cover <img>: src, alt, LCP hints, and data-cms-src / data-cms-alt hooks
//     (cover_<slug> / coverAlt_<slug>) so the admin panel can swap them live
//   - og:image, og:image:alt, twitter:image and the BlogPosting JSON-LD image,
//     using Cloudinary crops (1200x630 for social, 16:9 / 4:3 / 1:1 for Google)
//   - blog.html cards share the same CMS keys as the article cover
//   - sitemap.xml gets an <image:image> per post
// Safe to re-run: it rewrites the same tags every time.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://brandmarketian.com';
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/blog-images.json'), 'utf8'));
const slugs = Object.keys(map).filter((k) => !k.startsWith('_'));
const DIRS = ['prerender/src', 'frontend'];

const isCld = (u) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u || '');
const cld = (u, t) => u.replace(/\/image\/upload\/(?:[a-z]{1,3}_[^/]*\/)?/, `/image/upload/${t}/`);
const abs = (u) => (/^https?:/.test(u) ? u : SITE + u);
const attr = (tag, name) => ((tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1] || '');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Self-hosted post image: /assets/blog/<slug>.webp plus the crops written
// alongside it (<slug>.jpg, -og.jpg, -4x3.webp, -1x1.jpg).
const localBase = (u) => {
  const m = /^\/assets\/blog\/([a-z0-9-]+)\.webp$/.exec(u || '');
  return m && fs.existsSync(path.join(ROOT, 'frontend/assets/blog', `${m[1]}-og.jpg`)) ? `/assets/blog/${m[1]}` : null;
};

// Every size a post image is used at, for either storage.
function variants(src) {
  if (isCld(src)) return {
    cover: cld(src, 'c_fill,g_auto,w_1600,h_900,f_auto,q_auto'),
    card: cld(src, 'c_fill,g_auto,w_800,h_600,f_auto,q_auto'),
    og: cld(src, 'c_fill,g_auto,w_1200,h_630,f_jpg,q_auto'),
    ld: ['w_1600,h_900', 'w_1200,h_900', 'w_1200,h_1200'].map((s) => cld(src, `c_fill,g_auto,${s},f_jpg,q_auto`))
  };
  const b = localBase(src);
  if (b) return {
    cover: `${b}.webp`, card: `${b}-4x3.webp`, og: SITE + `${b}-og.jpg`,
    ld: [SITE + `${b}.jpg`, SITE + `${b}-4x3.webp`, SITE + `${b}-1x1.jpg`]
  };
  return null;
}

function coverFor(slug, currentTag) {
  const e = map[slug];
  const src = e.image || attr(currentTag, 'src');
  const alt = (e.image && e.alt) || attr(currentTag, 'alt');
  return { src, alt, v: variants(src) };
}

let changed = 0;
const write = (file, before, after) => {
  if (before !== after) { fs.writeFileSync(file, after); changed++; console.log('updated', path.relative(ROOT, file)); }
};

for (const dir of DIRS) {
  for (const slug of slugs) {
    const file = path.join(ROOT, dir, `blog-${slug}.html`);
    if (!fs.existsSync(file)) { console.warn('missing', path.relative(ROOT, file)); continue; }
    const html = fs.readFileSync(file, 'utf8');
    let out = html;

    const m = out.match(/(<figure class="bm-cover">\s*)(<img[^>]*>)/);
    if (!m) { console.warn('no cover in', path.relative(ROOT, file)); continue; }
    const c = coverFor(slug, m[2]);
    const imgSrc = c.v ? c.v.cover : c.src;
    const img = `<img src="${escAttr(imgSrc)}" alt="${escAttr(c.alt)}" width="1600" height="900" fetchpriority="high" decoding="async" data-cms-src="cover_${slug}" data-cms-alt="coverAlt_${slug}">`;
    out = out.replace(m[0], m[1] + img);

    // Social + structured data: only when the cover is a real post image
    // (Cloudinary or self-hosted crops), otherwise keep the default share card.
    if (c.v) {
      const og = c.v.og;
      out = out.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${og}$2`);
      out = out.replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${og}$2`);
      out = out.replace(/\n<meta property="og:image:alt" content="[^"]*">/, '');
      out = out.replace(/(<meta property="og:image:height" content="[^"]*">)/, `$1\n<meta property="og:image:alt" content="${escAttr(c.alt)}">`);
      if (!/name="twitter:image:alt"/.test(out)) {
        out = out.replace(/(<meta name="twitter:image" content="[^"]*">)/, `$1\n<meta name="twitter:image:alt" content="${escAttr(c.alt)}">`);
      } else {
        out = out.replace(/(<meta name="twitter:image:alt" content=")[^"]*(">)/, `$1${escAttr(c.alt)}$2`);
      }
      const ld = JSON.stringify(c.v.ld);
      out = out.replace(/"image": (\[[^\]]*\]|"[^"]*")/, `"image": ${ld}`);
    }
    write(file, html, out);
  }

  // Blog listing cards reuse the article's CMS keys.
  const listFile = path.join(ROOT, dir, 'blog.html');
  const list = fs.readFileSync(listFile, 'utf8');
  let lout = list;
  for (const slug of slugs) {
    const re = new RegExp(`(<a class="bmb-card" href="/blog-${slug}"[^>]*>\\s*<div class="bmb-shot">)(<img[^>]*>)`, 'g');
    lout = lout.replace(re, (all, pre, tag) => {
      const c = coverFor(slug, tag);
      const src = c.v ? c.v.card : c.src;
      return `${pre}<img src="${escAttr(src)}" alt="${escAttr(c.alt)}" loading="lazy" decoding="async" width="1200" height="900" data-cms-src="cover_${slug}" data-cms-alt="coverAlt_${slug}">`;
    });
  }
  write(listFile, list, lout);
}

// Image sitemap entries for posts with their own cover image.
const smFile = path.join(ROOT, 'frontend/sitemap.xml');
const sm = fs.readFileSync(smFile, 'utf8');
let smOut = sm.replace(/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');
for (const slug of slugs) {
  const e = map[slug];
  const re = new RegExp(`(<url><loc>${SITE}/blog-${slug}</loc>.*?)(<image:image>.*?</image:image>)?</url>`);
  smOut = smOut.replace(re, (all, head) => {
    const v = variants(e.image);
    if (!v) return `${head}</url>`;
    return `${head}<image:image><image:loc>${v.ld[0]}</image:loc></image:image></url>`;
  });
}
write(smFile, sm, smOut);
console.log(changed ? `${changed} file(s) updated` : 'already up to date');
