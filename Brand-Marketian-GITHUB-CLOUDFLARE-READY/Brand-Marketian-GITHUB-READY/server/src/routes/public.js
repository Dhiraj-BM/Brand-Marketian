import { Router } from 'express';
import { z } from 'zod';
import { Lead, Subscriber, Post, CaseStudy, Job, Application, SiteContent } from '../models.js';
import { notifyLead } from '../notify.js';
import { upload } from '../upload.js';

const router = Router();

const leadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  services: z.array(z.string()).optional(),
  budget: z.string().optional(),
  message: z.string().optional(),
  segment: z.enum(['d2c', 'b2b', 'local', 'other']).optional(),
  source: z.string().optional(),
  page: z.string().optional(),
  utm: z.object({ source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional() }).partial().optional()
});

router.post('/leads', async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: 'Invalid form', issues: parsed.error.issues });
  const lead = await Lead.create(parsed.data);
  notifyLead(lead).catch(() => {});
  res.status(201).json({ ok: true, id: lead._id });
});

router.post('/newsletter', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ error: 'Invalid email' });
  await Subscriber.updateOne({ email }, { $set: { active: true, source: req.body.source || 'footer' } }, { upsert: true });
  res.status(201).json({ ok: true });
});

router.post('/applications', upload.single('resume'), async (req, res) => {
  const { name, email, phone, portfolio, why, roleTitle, job } = req.body;
  if (!name || !email) return res.status(422).json({ error: 'Name and email are required' });
  const app = await Application.create({
    name, email, phone, portfolio, why, roleTitle,
    job: job || undefined,
    resumePath: req.file ? '/uploads/' + req.file.filename : undefined
  });
  res.status(201).json({ ok: true, id: app._id });
});

router.get('/posts', async (req, res) => {
  const q = { published: true };
  if (req.query.tag && req.query.tag !== 'All') q.tag = req.query.tag;
  const posts = await Post.find(q).sort({ publishedAt: -1 }).select('-body').limit(Number(req.query.limit || 24));
  res.json(posts);
});

router.get('/posts/:slug', async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug, published: true });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

router.get('/case-studies', async (req, res) => {
  const q = { published: true };
  if (req.query.segment) q.segment = req.query.segment;
  if (req.query.industry) q.industry = req.query.industry;
  res.json(await CaseStudy.find(q).sort({ createdAt: -1 }));
});

router.get('/case-studies/:slug', async (req, res) => {
  const cs = await CaseStudy.findOne({ slug: req.params.slug, published: true });
  if (!cs) return res.status(404).json({ error: 'Not found' });
  res.json(cs);
});

router.get('/content/:key', async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  res.json(doc ? doc.data : {});
});

router.get('/jobs', async (_req, res) => {
  res.json(await Job.find({ open: true }).sort({ createdAt: -1 }));
});

export default router;
