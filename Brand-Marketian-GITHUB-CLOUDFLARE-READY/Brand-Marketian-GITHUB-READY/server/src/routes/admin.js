import { Router } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { Lead, Subscriber, Post, CaseStudy, Job, Application, User, SiteContent, Media } from '../models.js';
import { requireAuth, sign } from '../auth.js';
import { upload } from '../upload.js';

const router = Router();

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: sign(user), user: { email: user.email, name: user.name, role: user.role } });
});

router.get('/auth/me', requireAuth(['admin', 'editor', 'client']), (req, res) => res.json(req.user));

router.get('/leads', requireAuth(), async (req, res) => {
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.segment) q.segment = req.query.segment;
  if (req.query.q) q.$or = [
    { name: new RegExp(req.query.q, 'i') },
    { email: new RegExp(req.query.q, 'i') },
    { company: new RegExp(req.query.q, 'i') }
  ];
  const page = Number(req.query.page || 1), limit = Number(req.query.limit || 50);
  const [items, total] = await Promise.all([
    Lead.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Lead.countDocuments(q)
  ]);
  res.json({ items, total, page, limit });
});

router.patch('/leads/:id', requireAuth(), async (req, res) => {
  const { status, owner, note } = req.body;
  const update = {};
  if (status) update.status = status;
  if (owner) update.owner = owner;
  const ops = { $set: update };
  if (note) ops.$push = { notes: { body: note } };
  const lead = await Lead.findByIdAndUpdate(req.params.id, ops, { new: true });
  res.json(lead);
});

router.get('/stats', requireAuth(), async (_req, res) => {
  const since = new Date(Date.now() - 29 * 864e5);
  const [byStatus, bySegment, daily, totals] = await Promise.all([
    Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$segment', n: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Promise.all([Lead.countDocuments(), Subscriber.countDocuments({ active: true }), Application.countDocuments()])
  ]);
  res.json({ byStatus, bySegment, daily, leads: totals[0], subscribers: totals[1], applications: totals[2] });
});

router.get('/content/:key', requireAuth(), async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  res.json(doc ? doc.data : {});
});

router.put('/content/:key', requireAuth(), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { data: req.body, updatedBy: req.user.email } },
    { new: true, upsert: true }
  );
  res.json(doc.data);
});

router.post('/media', requireAuth(), upload.any(), async (req, res) => {
  const files = (req.files || []).map(f => ({
    name: f.originalname, path: '/uploads/' + f.filename, mime: f.mimetype, size: f.size, tag: req.body.tag
  }));
  const saved = await Media.insertMany(files);
  res.status(201).json(saved);
});

router.get('/media', requireAuth(), async (_req, res) =>
  res.json(await Media.find().sort({ createdAt: -1 })));

router.delete('/media/:id', requireAuth(), async (req, res) => {
  await Media.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

function crud(path, Model, slugFrom) {
  router.get('/' + path, requireAuth(), async (_req, res) => res.json(await Model.find().sort({ createdAt: -1 })));
  router.post('/' + path, requireAuth(), async (req, res) => {
    const body = { ...req.body };
    if (slugFrom && !body.slug) body.slug = slugify(String(body[slugFrom] || ''), { lower: true, strict: true });
    res.status(201).json(await Model.create(body));
  });
  router.patch('/' + path + '/:id', requireAuth(), async (req, res) =>
    res.json(await Model.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true })));
  router.delete('/' + path + '/:id', requireAuth(), async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  });
}

crud('posts', Post, 'title');
crud('case-studies', CaseStudy, 'title');
crud('jobs', Job, 'title');

router.get('/applications', requireAuth(), async (_req, res) =>
  res.json(await Application.find().sort({ createdAt: -1 }).populate('job', 'title')));
router.get('/subscribers', requireAuth(), async (_req, res) =>
  res.json(await Subscriber.find({ active: true }).sort({ createdAt: -1 })));

export default router;
