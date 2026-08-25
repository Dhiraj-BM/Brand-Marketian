import bcrypt from 'bcryptjs';
import { connectDb } from './db.js';
import { config } from './config.js';
import { User, Post, CaseStudy, Job, SiteContent } from './models.js';

await connectDb();

const hash = await bcrypt.hash(config.admin.password, 10);
await User.updateOne(
  { email: config.admin.email },
  { $set: { passwordHash: hash, name: 'Brand Marketian Admin', role: 'admin' } },
  { upsert: true }
);

const posts = [
  { slug: 'good-cpl-india-2026', title: 'What a good cost per lead actually looks like in India in 2026', tag: 'Benchmarks', readMinutes: 4, excerpt: 'Live CPL ranges by category, and the three things that explain almost every outlier.', published: true, publishedAt: new Date() },
  { slug: 'festive-ad-calendar-d2c', title: 'The festive ad calendar we run for D2C brands', tag: 'Playbook', readMinutes: 6, excerpt: 'Diwali, Holi and end-of-season, mapped backwards from the sale date.', published: true, publishedAt: new Date() },
  { slug: 'reels-vs-ad-budget', title: 'Nine reels that outperformed a 2 lakh ad budget', tag: 'Teardown', readMinutes: 5, excerpt: 'Hooks, pacing and captions: what the winners had in common.', published: true, publishedAt: new Date() }
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
  servicesSub: 'One team instead of four vendors. Pick a single pillar or let us run all three together, tuned for how India actually buys: mobile-first, vernacular, festive, WhatsApp-led.',
  buyersTitle: 'Two very different buyers. Two different playbooks.',
  journeyTitle: 'The B lies flat until marketing joins it',
  clientsTitle: 'Brands that trust us with their growth',
  compareTitle: 'Why brands pick us over a freelancer or a big agency',
  processTitle: 'A simple, proven process',
  indiaTitle: 'Marketing that speaks your market',
  pricingTitle: 'Three plans. One that fits.',
  storiesTitle: 'Results, not screenshots'
};
await SiteContent.updateOne({ key: 'home' }, { $set: { data: home, updatedBy: 'seed' } }, { upsert: true });

console.log('[seed] done. Admin:', config.admin.email);
process.exit(0);
