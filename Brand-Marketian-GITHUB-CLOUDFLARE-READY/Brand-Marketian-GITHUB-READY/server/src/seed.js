import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { config } from './config.js';
import { User, Post, CaseStudy, Job, SiteContent } from './models.js';

await connectDb();

const hash = await bcrypt.hash(config.admin.password, 10);
await User.updateOne(
  { email: config.admin.email },
  { $set: { passwordHash: hash, name: 'Brand Marketian Admin', role: 'super_admin', active: true } },
  { upsert: true }
);

// Mirrors the six static articles under frontend/ (blog-*.html). The public
// blog and article pages are served as static files — this collection is
// bookkeeping so the admin dashboard reflects what is actually published.
const posts = [
  { slug: 'blog-festive-ad-calendar-d2c', title: 'The festive ad calendar we run for D2C brands', tag: 'Paid ads', readMinutes: 6, cover: '/assets/blog/festive.jpg', excerpt: 'Diwali, Holi and end-of-season, mapped backwards from the sale date.', published: true, publishedAt: new Date() },
  { slug: 'blog-cpl-india-2026', title: 'What a good cost per lead actually looks like in India in 2026', tag: 'Benchmarks', readMinutes: 4, cover: '/assets/blog/cpl.jpg', excerpt: 'Live CPL ranges by category, and the three things that explain almost every outlier.', published: true, publishedAt: new Date() },
  { slug: 'blog-nine-reels-beat-2l-budget', title: 'Nine reels that outperformed a ₹2L ad budget', tag: 'Creative', readMinutes: 5, cover: '/assets/blog/reels.jpg', excerpt: 'Hooks, pacing and captions: what the winners had in common, frame by frame.', published: true, publishedAt: new Date() },
  { slug: 'blog-whatsapp-funnels', title: "WhatsApp funnels that don't annoy people", tag: 'Retention', readMinutes: 7, cover: '/assets/blog/whatsapp.jpg', excerpt: 'Opt-in, first message and a cadence that keeps reply rates above 40%.', published: true, publishedAt: new Date() },
  { slug: 'blog-local-seo-multi-location', title: 'Local SEO for multi-location businesses', tag: 'SEO', readMinutes: 6, cover: '/assets/blog/localseo.jpg', excerpt: 'One Google Business Profile per location, done properly, beats any amount of blog content.', published: true, publishedAt: new Date() },
  { slug: 'blog-marketing-budget-by-stage', title: 'How much should a growing brand spend on marketing?', tag: 'Benchmarks', readMinutes: 5, cover: '/assets/blog/budget.jpg', excerpt: 'Retainer plus spend, by revenue stage, with the split we recommend at each.', published: true, publishedAt: new Date() }
];
for (const p of posts) await Post.updateOne({ slug: p.slug }, { $set: p }, { upsert: true });

const cases = [
  { slug: 'skincare-organic-reach', title: 'A skincare brand that stopped buying reach', segment: 'd2c', industry: 'D2C / e-commerce', service: 'Social + Ads', published: true,
    metrics: [{ value: '3.4x', label: 'reach in 90 days' }, { value: '58', label: 'cost per lead (INR)' }, { value: '18%', label: 'DM to order rate' }] },
  { slug: 'industrial-b2b-pipeline', title: 'Industrial B2B: 11 qualified enquiries a week', segment: 'b2b', industry: 'B2B & enterprise', service: 'SEO + Content', published: true,
    metrics: [{ value: '11 / wk', label: 'qualified enquiries' }, { value: '6.2K', label: 'cost per demo (INR)' }, { value: '2.4x', label: 'sales accepted rate' }] },
  { slug: 'clinic-chain-cpl', title: 'Clinic chain: half the cost per lead, twice the shows', segment: 'local', industry: 'Local & clinics', service: 'Performance ads', published: true,
    metrics: [{ value: '54%', label: 'lower CPL' }, { value: '2.2x', label: 'appointment shows' }, { value: '7', label: 'cities live' }] }
];
for (const c of cases) await CaseStudy.updateOne({ slug: c.slug }, { $set: c }, { upsert: true });

const jobs = [
  { slug: 'performance-marketer', title: 'Performance Marketer', experience: '2-4 yrs', blurb: 'Own Meta and Google spend across five accounts, and the CPL that comes with it.' },
  { slug: 'social-media-manager', title: 'Social Media Manager', experience: '1-3 yrs', blurb: 'Calendars, community and copy in English and Hinglish.' },
  { slug: 'video-editor', title: 'Video Editor / Reel Creator', experience: '1-3 yrs', location: 'On-site', blurb: 'Hook-first edits with a 48 hour turnaround.' }
];
for (const j of jobs) await Job.updateOne({ slug: j.slug }, { $set: j }, { upsert: true });

const home = {
  heroEyebrow: 'For founders and small business owners',
  heroTitle: 'Posting every day and still not getting ',
  heroTitleAccent: 'customers?',
  heroSub: 'You do not need more posts. You need a system. We run your social, your ads and your website as one growth engine, so enquiries land in your inbox instead of likes on a post.',
  heroCta: 'Book a free audit for your business',
  servicesTitle: 'Meet your ',
  servicesTitleAccent: 'growth engine',
  servicesSub: 'One team instead of four vendors. Pick a single pillar or let us run all three together as one system, from the brand up.',
  buyersTitle: 'Two very different buyers. Two different plans.',
  journeyTitle: 'The B lies flat until marketing joins it',
  clientsTitle: 'Brands that trust us with their growth',
  compareTitle: 'Why brands pick us over a freelancer or a big agency',
  indiaTitle: 'Marketing that speaks your market',
  pricingTitle: 'Three plans. One that fits.',
  storiesTitle: 'Results, not screenshots',
  homeInfEyebrow: 'New · Influencer Marketing',
  homeInfTitle: 'Creators who sell your product, not just tag it.',
  homeInfSub: 'The right creators, briefs that convert, and campaigns measured in orders and revenue — not vanity views.',
  homeInfCta: 'Explore influencer marketing →'
};
await SiteContent.updateOne({ key: 'home' }, { $setOnInsert: { data: home, updatedBy: 'seed', status: 'published' } }, { upsert: true });

const influencer = {
  infHeroEyebrow: 'Influencer & Creator Marketing',
  infHeroTitle: 'Creators who sell your product, ',
  infHeroTitleAccent: 'not just tag it.',
  infHeroSub: 'We match your brand with the right creators, write briefs that actually convert, and run the whole campaign to a number that matters — enquiries, orders and revenue, not vanity views.',
  infHeroCta: 'Plan my creator campaign',
  infStat1Num: '1,200+', infStat1Label: 'Vetted creators in our network',
  infStat2Num: '50+', infStat2Label: 'Brands run and scaled',
  infStat3Num: '300+', infStat3Label: 'Campaigns shipped',
  infStat4Num: '4.2x', infStat4Label: 'Median return on creator spend',
  infHowKicker: 'How we run it', infHowTitle: 'Three moves, one accountable team',
  infHowSub: 'No random shout-outs. A tight system from creator selection to the sale, with tracking on every rupee.',
  infStep1Title: 'Match the right creators', infStep1Body: 'We shortlist creators by real audience fit, engagement quality and past sales — not follower counts. Nano to celebrity, across every major language and niche.',
  infStep2Title: 'Build campaigns that convert', infStep2Body: 'Hooks, briefs, scripts, offers and landing pages built to move product. Whitelisting and paid amplification so a winning post keeps selling.',
  infStep3Title: 'Deliver real brand impact', infStep3Body: 'UTMs, promo codes and a live dashboard tie every creator to enquiries and orders — so you know exactly what worked and what to scale.',
  infGetTitle: "What's included",
  infGet1Title: 'Creator sourcing & vetting', infGet1Body: 'Audience checks, rate negotiation and contracts handled for you.',
  infGet2Title: 'Content & scripting', infGet2Body: 'Hooks and briefs built for reach and conversion, on-brand every time.',
  infGet3Title: 'Paid amplification', infGet3Body: 'Whitelisting and Spark/partnership ads to scale the posts that work.',
  infGet4Title: 'Tracking & reporting', infGet4Body: 'Promo codes, UTMs and a dashboard from view to sale.',
  infNicheTitle: 'Creators for every category',
  infNicheSub: 'Beauty, fashion, food, fitness, tech, finance, travel, parenting, gaming, regional comedy and more — matched to how your buyers actually shop.',
  infResultsTitle: 'Results, not screenshots',
  infRes1Num: '₹58', infRes1Label: 'cost per order via creators, skincare D2C',
  infRes2Num: '11x', infRes2Label: 'reach vs paid-only, regional food brand',
  infRes3Num: '3.4x', infRes3Label: 'return on creator spend in 90 days',
  infCtaTitle: 'Ready to turn creators into customers?',
  infCtaSub: "Tell us your product and your goal. We'll come back with a creator plan and a number to aim for — within 48 hours.",
  infCtaBtn: 'Book a free audit'
};
await SiteContent.updateOne({ key: 'influencer' }, { $setOnInsert: { data: influencer, updatedBy: 'seed', status: 'published' } }, { upsert: true });

const global = {
  companyName: 'Brand Marketian',
  tagline: 'Growth Agency for Brands',
  contactEmail: 'growth@brandmarketian.com',
  contactPhone: '+91 96506 18193',
  logo: '/logo.jpg',
  favicon: '/favicon.ico',
  instagram: 'https://www.instagram.com/brand.marketian/',
  whatsapp: 'https://wa.me/919650618193',
  linkedin: '',
  footerText: '© Brand Marketian. Marketing that turns spend into countable enquiries.',
  seoTitle: 'Brand Marketian | Growth Agency for Brands',
  seoDescription: 'Brand Marketian is a growth agency that builds brands from scratch — brand, social, paid ads and CRM follow-up run as one system that turns spend into countable enquiries.'
};
await SiteContent.updateOne({ key: 'global' }, { $setOnInsert: { data: global, updatedBy: 'seed', status: 'published' } }, { upsert: true });

console.log('[seed] done. Admin:', config.admin.email);
process.exit(0);
