/* Brand Marketian — image proxy for creator avatars / post thumbnails.

   Instagram's CDN URLs (scontent*.cdninstagram.com, *.fbcdn.net) are signed,
   expire within hours, and block hot-linking from other origins — so pasting
   them straight into an <img> on brandmarketian.com shows a broken image.

   This endpoint fetches the image server-side (where there is no cross-origin
   restriction) and re-serves the bytes from our own domain with permissive
   caching + CORS. creator.js rewrites provider avatar URLs to point here.

   GET /api/creator/avatar?u=<url-encoded https image url>
   Only Instagram / Facebook CDN hosts are allowed (SSRF guard). */

const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export async function proxyAvatar(req, res) {
  const raw = String(req.query.u || '').trim();
  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'bad url' });
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOST.test(target.hostname)) {
    return res.status(400).json({ error: 'host not allowed' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // IG's CDN is friendlier to requests that look like a browser coming from instagram.com
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
        'Referer': 'https://www.instagram.com/'
      }
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: 'upstream ' + upstream.status });
    }
    const type = upstream.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(type)) {
      return res.status(415).json({ error: 'not an image' });
    }
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len && len > MAX_BYTES) {
      return res.status(413).json({ error: 'too large' });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return res.status(413).json({ error: 'too large' });
    }
    res.set({
      'Content-Type': type,
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(buf);
  } catch (e) {
    return res.status(504).json({ error: 'fetch failed', detail: e.name });
  } finally {
    clearTimeout(timer);
  }
}
