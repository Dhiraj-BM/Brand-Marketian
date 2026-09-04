/* Brand Marketian — Instagram creator insights.
   Turns an Instagram handle into the exact shape the website's lookup tool
   renders. It talks to a third-party creator-analytics provider on the SERVER
   (never the browser — the API key stays here), normalises the result, caches
   it, and falls back to realistic sample data so the site never breaks.

   Configure with env vars (see config.js):
     CREATOR_PROVIDER = sample | modash | rapidapi   (default: sample)
     MODASH_API_KEY   = <your Modash key>            (for provider=modash)
     RAPIDAPI_KEY     = <your RapidAPI key>           (for provider=rapidapi)
     RAPIDAPI_HOST    = <e.g. instagram-scraper-api2.p.rapidapi.com>
     CREATOR_CACHE_TTL_MS = 86400000                  (24h default)

   Output shape (matches frontend render()):
     { name, handle, cat, av, aq, aqnote, followers, eng, engtag,
       views, cost, grad, vidtitle, vv, vl, vc, vs } */
import { config } from './config.js';

/* ---------- small formatters ---------- */
function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 ? 1 : 0).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1) + '%'; } // 0.068 -> "6.8%"
function engTag(rate) {                 // rate as a fraction, e.g. 0.068
  if (rate >= 0.06) return 'EXCELLENT';
  if (rate >= 0.035) return 'STRONG';
  if (rate >= 0.02) return 'GOOD';
  return 'AVERAGE';
}
// Rough India rate card per Reel by follower tier (₹), used for an estimate.
function estCost(followers) {
  const f = Number(followers) || 0;
  if (f < 10000) return '₹3–8K';
  if (f < 50000) return '₹8–25K';
  if (f < 200000) return '₹25–75K';
  if (f < 1000000) return '₹75K–1.8L';
  return '₹1.8L+';
}
const TINTS = ['#ffd8bf', '#cdd6ff', '#ffe4a3', '#d6f0e6', '#f0d6ff'];
const GRADS = ['linear-gradient(135deg,#ff9a5a,#e05600)', 'linear-gradient(135deg,#5a74f2,#1b3bd8)',
  'linear-gradient(135deg,#f26fae,#b3275f)', 'linear-gradient(135deg,#2bb3a3,#0e7c86)'];
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/* ---------- normaliser: raw provider data -> frontend shape ----------
   Pass whatever numbers you can extract; missing fields are estimated. */
function normalise(r) {
  const handle = '@' + String(r.handle || 'creator').replace(/^@/, '');
  const followers = Number(r.followers) || 0;
  const engRate = r.engagementRate != null ? Number(r.engagementRate)   // fraction 0..1
    : (followers && r.avgLikes != null ? (Number(r.avgLikes) + Number(r.avgComments || 0)) / followers : 0.03);
  const h = hash(handle);
  const av = r.avatar && /^https?:/.test(r.avatar) ? r.avatar : TINTS[h % TINTS.length];
  const grad = r.videoThumb && /^https?:/.test(r.videoThumb) ? r.videoThumb : GRADS[h % GRADS.length];
  const aq = r.audienceQuality != null ? Math.round(Number(r.audienceQuality))
    : Math.max(60, Math.min(96, Math.round(72 + engRate * 300)));         // estimate if unknown
  return {
    name: r.name || handle.replace(/^@/, ''),
    handle,
    cat: r.category || 'Creator',
    av,
    aq,
    aqnote: r.audienceNote || (r.audienceQuality != null
      ? 'Verified audience credibility' : 'Estimated from engagement — connect an audience API for a real score'),
    followers: fmt(followers),
    eng: pct(engRate),
    engtag: engTag(engRate),
    views: fmt(r.avgViews != null ? r.avgViews : Math.round(followers * (r.viewRate || 1.25))),
    cost: r.estCost || estCost(followers),
    grad,
    vidtitle: r.topTitle || 'Top-performing recent Reel',
    vv: fmt(r.topViews != null ? r.topViews : Math.round(followers * 3)),
    vl: fmt(r.topLikes != null ? r.topLikes : Math.round(followers * 0.28)),
    vc: fmt(r.topComments != null ? r.topComments : Math.round(followers * 0.01)),
    vs: fmt(r.topSaves != null ? r.topSaves : Math.round(followers * 0.06))
  };
}

/* ---------- sample fallback (no key needed) ---------- */
const SAMPLES = {
  'ananya.eats': { name: 'Ananya Rao', handle: 'ananya.eats', category: 'Food & Lifestyle · Mumbai', followers: 248000, engagementRate: 0.068, avgViews: 312000, audienceQuality: 92, audienceNote: 'Real, India-based followers · low bot risk', topTitle: '“5 street foods under ₹50 every Mumbaikar swears by”', topViews: 1200000, topLikes: 84000, topComments: 2100, topSaves: 19000 },
  'karanlifts': { name: 'Karan Mehta', handle: 'karanlifts', category: 'Fitness · Delhi NCR', followers: 512000, engagementRate: 0.054, avgViews: 480000, audienceQuality: 88, audienceNote: 'Strong male 18–34 audience · low bot risk', topTitle: '“The ₹0 home workout that actually builds muscle”', topViews: 2400000, topLikes: 171000, topComments: 3800, topSaves: 42000 },
  'simran.glow': { name: 'Simran Kaur', handle: 'simran.glow', category: 'Beauty & Skincare · Chandigarh', followers: 1200000, engagementRate: 0.041, avgViews: 640000, audienceQuality: 85, audienceNote: 'High female 18–30 reach · verified creator', topTitle: '“I tried the viral ₹299 serum for 30 days”', topViews: 3100000, topLikes: 214000, topComments: 6200, topSaves: 58000 },
  'devbuilds': { name: 'Dev Malhotra', handle: 'devbuilds', category: 'Tech & Gadgets · Bengaluru', followers: 86000, engagementRate: 0.079, avgViews: 138000, audienceQuality: 94, audienceNote: 'Niche high-intent buyers · very low bot risk', topTitle: '“5 gadgets under ₹2,000 that feel premium”', topViews: 720000, topLikes: 61000, topComments: 1900, topSaves: 24000 }
};
export function getSample(handle) {
  const key = String(handle || '').trim().replace(/^@/, '').toLowerCase();
  if (SAMPLES[key]) return normalise(SAMPLES[key]);
  // deterministic pseudo-result for any other handle
  const keys = Object.keys(SAMPLES);
  const base = { ...SAMPLES[keys[key.length % keys.length]] };
  base.handle = key || 'creator';
  base.name = key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/[._]/g, ' ') : base.name;
  return normalise(base);
}

/* ---------- provider: Modash ----------
   Docs: https://docs.modash.io  (Discovery / Influencer Report API)
   Two calls: resolve handle -> userId, then pull the report. */
async function fromModash(handle) {
  const key = config.creator.modashKey;
  const H = { Authorization: 'Bearer ' + key, Accept: 'application/json' };
  const q = encodeURIComponent(handle.replace(/^@/, ''));
  const sres = await fetch('https://api.modash.io/v1/instagram/users?query=' + q + '&limit=1', { headers: H });
  if (!sres.ok) throw new Error('modash search ' + sres.status);
  const sjson = await sres.json();
  const user = (sjson.users || sjson.data || sjson.lookalikes || [])[0];
  const userId = user && (user.userId || user.user_id || user.id);
  if (!userId) throw new Error('modash: handle not found');
  const rres = await fetch('https://api.modash.io/v1/instagram/profile/' + userId + '/report', { headers: H });
  if (!rres.ok) throw new Error('modash report ' + rres.status);
  const body = await rres.json();
  const rep = body.profile || body;                   // schema varies by plan
  const p = rep.profile || rep;
  const aud = rep.audience || {};
  const pop = (rep.popularPosts || rep.recentPosts || [])[0] || {};
  return {
    handle: p.username || handle, name: p.fullname || p.fullName || p.username,
    category: (p.interests && p.interests[0] && p.interests[0].name) || undefined,
    avatar: p.picture, followers: p.followers, engagementRate: p.engagementRate,
    avgLikes: p.avgLikes, avgComments: p.avgComments, avgViews: p.avgViews || p.avgReelsPlays,
    audienceQuality: aud.credibility != null ? Math.round(aud.credibility * 100) : undefined,
    audienceNote: aud.credibility != null ? 'Modash audience credibility ' + Math.round(aud.credibility * 100) + '%' : undefined,
    topTitle: pop.text ? '“' + String(pop.text).slice(0, 70) + '”' : undefined,
    videoThumb: pop.thumbnail || pop.image, topViews: pop.views || pop.video_views,
    topLikes: pop.likes, topComments: pop.comments, topSaves: pop.saves
  };
}

/* ---------- provider: RapidAPI (Instagram Looter, free tier) ----------
   Wired against "Instagram Looter" (instagram-looter2.p.rapidapi.com) —
   confirmed working on its $0/mo Basic plan (150 requests/month, no card
   required). Two calls per lookup, both cached for CREATOR_CACHE_TTL_MS:
     1. GET /profile?username=<handle>     -> followers, name, avatar, bio
     2. GET /user-feeds?id=<id>&count=12   -> recent posts for engagement
   If you switch to a different RapidAPI Instagram listing, its response
   shape will differ — adjust the field names marked ADJUST below to match. */
async function fromRapidApi(handle) {
  const host = config.creator.rapidapiHost;
  const H = { 'x-rapidapi-key': config.creator.rapidapiKey, 'x-rapidapi-host': host };
  const user = handle.replace(/^@/, '');

  const pRes = await fetch('https://' + host + '/profile?username=' + encodeURIComponent(user), { headers: H });
  if (!pRes.ok) throw new Error('rapidapi profile ' + pRes.status);
  const p = await pRes.json();                                    // ADJUST if not Instagram Looter
  if (p.status === false) throw new Error('rapidapi: ' + (p.errorMessage || 'profile not found'));
  const followers = p.edge_followed_by?.count ?? p.follower_count ?? 0;

  let avgLikes, avgComments, best = null, bestScore = -1;
  try {
    const mRes = await fetch('https://' + host + '/user-feeds?id=' + encodeURIComponent(p.id) + '&count=12&allow_restricted_media=false', { headers: H });
    if (mRes.ok) {
      const m = await mRes.json();
      const items = Array.isArray(m.items) ? m.items : [];
      let likes = 0, comments = 0, n = 0;
      for (const it of items) {
        const l = it.like_count ?? 0, c = it.comment_count ?? 0;
        likes += l; comments += c; n++;
        const views = it.play_count ?? it.ig_play_count ?? it.fb_play_count ?? 0;
        // Rank reels by view count; rank photo posts (no view count) by likes instead.
        const score = views > 0 ? views : l;
        if (score > bestScore) {
          bestScore = score;
          best = { views, likes: l, comments: c, text: it.caption?.text || '', thumbnail: it.image_versions2?.candidates?.[0]?.url };
        }
      }
      if (n) { avgLikes = likes / n; avgComments = comments / n; }
    }
  } catch { /* media list is a bonus — a failed second call should not break the profile lookup */ }

  return {
    handle: p.username || user, name: p.full_name || p.username,
    avatar: p.profile_pic_url_hd || p.profile_pic_url,
    category: p.business_category_name || p.category_name || undefined,
    followers, avgLikes, avgComments, avgViews: best ? best.views || undefined : undefined,
    topTitle: best && best.text ? '“' + best.text.slice(0, 70) + '”' : undefined,
    videoThumb: best ? best.thumbnail : undefined, topViews: best ? best.views : undefined,
    topLikes: best ? best.likes : undefined, topComments: best ? best.comments : undefined
  };
}

/* ---------- cache (in-memory, TTL) ---------- */
const cache = new Map(); // handle -> { at, data }
function cacheGet(k) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < config.creator.cacheTtlMs) return hit.data;
  return null;
}
function cacheSet(k, data) { cache.set(k, { at: Date.now(), data }); if (cache.size > 500) cache.delete(cache.keys().next().value); }

/* ---------- public entry ---------- */
export async function getCreatorInsights(handle) {
  const key = String(handle || '').trim().replace(/^@/, '').toLowerCase();
  if (!key) return getSample('');
  const cached = cacheGet(key);
  if (cached) return cached;

  let data;
  try {
    const provider = config.creator.provider;
    if (provider === 'modash' && config.creator.modashKey) data = normalise(await fromModash(key));
    else if (provider === 'rapidapi' && config.creator.rapidapiKey && config.creator.rapidapiHost) data = normalise(await fromRapidApi(key));
    else data = getSample(key);                 // provider=sample or missing keys
  } catch (e) {
    console.error('[creator] provider failed for', key, '-', e.message, '— serving sample');
    data = getSample(key);                       // never break the page
  }
  cacheSet(key, data);
  return data;
}
