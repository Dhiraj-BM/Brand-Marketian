import fs from 'node:fs';
import nodePath from 'node:path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { Lead, Subscriber, Post, CaseStudy, Job, Application, User, SiteContent, Media } from '../models.js';
import { requireAuth, sign, ROLES } from '../auth.js';
import { upload } from '../upload.js';

const router = Router();
const MAX_VERSIONS = 30;

// Shape a content doc for the admin client.
function shapeContent(doc) {
  if (!doc) return null;
  return {
    key: doc.key,
    status: doc.status,
    hasDraft: !!doc.hasDraft,
    data: doc.data || {},
    draft: (doc.hasDraft ? doc.draft : doc.data) || {},
    submittedBy: doc.submittedBy,
    submittedAt: doc.submittedAt,
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt,
    publishedBy: doc.publishedBy,
    publishedAt: doc.publishedAt,
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt,
    versions: (doc.versions || []).slice(-MAX_VERSIONS).reverse().map(v => ({
      id: String(v._id), at: v.at, savedBy: v.savedBy, note: v.note, kind: v.kind
    }))
  };
}

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  if (user.active === false) return res.status(403).json({ error: 'This account has been disabled' });
  res.json({ token: sign(user), user: { email: user.email, name: user.name, role: user.role } });
});

router.get('/auth/me', requireAuth(ROLES.ALL), (req, res) => res.json(req.user));

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

/* ============================ CONTENT WORKFLOW ============================
   data   = published content (what the public site reads)
   draft  = in-progress edit
   Flow: draft -> in_review -> approved -> published                          */

// Overview of all page docs (for the Pages list).
router.get('/content', requireAuth(ROLES.ALL), async (_req, res) => {
  const docs = await SiteContent.find().select('-versions -data -draft').sort({ key: 1 });
  res.json(docs.map(d => ({
    key: d.key, status: d.status, hasDraft: !!d.hasDraft,
    updatedBy: d.updatedBy, updatedAt: d.updatedAt, publishedAt: d.publishedAt
  })));
});

// Full content doc (published + draft + versions summary).
router.get('/content/:key', requireAuth(ROLES.ALL), async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  res.json(shapeContent(doc) || { key: req.params.key, status: 'published', hasDraft: false, data: {}, draft: {}, versions: [] });
});

// Save a draft (does NOT touch the live site).
router.put('/content/:key/draft', requireAuth(ROLES.EDIT), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { draft: req.body || {}, hasDraft: true, status: 'draft', updatedBy: req.user.email } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(shapeContent(doc));
});

// Discard the draft, reverting the editor back to the published content.
router.post('/content/:key/revert-draft', requireAuth(ROLES.EDIT), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { draft: {}, hasDraft: false, status: 'published', updatedBy: req.user.email } },
    { new: true }
  );
  res.json(shapeContent(doc));
});

// Submit the draft for review.
router.post('/content/:key/submit', requireAuth(ROLES.EDIT), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { status: 'in_review', submittedBy: req.user.email, submittedAt: new Date() } },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Nothing to submit' });
  res.json(shapeContent(doc));
});

// Approve a submitted draft (does not publish yet).
router.post('/content/:key/approve', requireAuth(ROLES.PUBLISH), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { status: 'approved', reviewedBy: req.user.email, reviewedAt: new Date() } },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(shapeContent(doc));
});

// Publish: snapshot current live content, then promote draft -> live.
router.post('/content/:key/publish', requireAuth(ROLES.PUBLISH), async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const nextData = doc.hasDraft ? doc.draft : doc.data;
  // Snapshot the outgoing published version for history/restore.
  if (doc.data && Object.keys(doc.data).length) {
    doc.versions.push({ data: doc.data, savedBy: doc.publishedBy || doc.updatedBy, note: req.body?.note || '', kind: 'published', at: new Date() });
    if (doc.versions.length > MAX_VERSIONS) doc.versions = doc.versions.slice(-MAX_VERSIONS);
  }
  doc.data = nextData || {};
  doc.draft = {};
  doc.hasDraft = false;
  doc.status = 'published';
  doc.publishedBy = req.user.email;
  doc.publishedAt = new Date();
  doc.updatedBy = req.user.email;
  await doc.save();
  res.json(shapeContent(doc));
});

// Version history (full data for a single version, or the list).
router.get('/content/:key/versions', requireAuth(ROLES.ALL), async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  if (!doc) return res.json([]);
  res.json((doc.versions || []).slice(-MAX_VERSIONS).reverse().map(v => ({
    id: String(v._id), at: v.at, savedBy: v.savedBy, note: v.note, kind: v.kind, data: v.data
  })));
});

// Restore a previous version into the draft (still needs publishing to go live).
router.post('/content/:key/restore/:versionId', requireAuth(ROLES.EDIT), async (req, res) => {
  const doc = await SiteContent.findOne({ key: req.params.key });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const v = (doc.versions || []).id(req.params.versionId);
  if (!v) return res.status(404).json({ error: 'Version not found' });
  doc.draft = v.data || {};
  doc.hasDraft = true;
  doc.status = 'draft';
  doc.updatedBy = req.user.email;
  await doc.save();
  res.json(shapeContent(doc));
});

// Legacy direct-publish endpoint kept for backwards compatibility (admins only).
router.put('/content/:key', requireAuth(ROLES.PUBLISH), async (req, res) => {
  const doc = await SiteContent.findOneAndUpdate(
    { key: req.params.key },
    { $set: { data: req.body, status: 'published', hasDraft: false, draft: {}, publishedBy: req.user.email, publishedAt: new Date(), updatedBy: req.user.email } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json(doc.data);
});

/* ================================ MEDIA ================================= */

router.post('/media', requireAuth(ROLES.EDIT), upload.any(), async (req, res) => {
  const files = (req.files || []).map(f => ({
    name: f.originalname, path: '/uploads/' + f.filename, mime: f.mimetype, size: f.size,
    tag: req.body.tag || 'Website Images', alt: req.body.alt || '', uploadedBy: req.user.email
  }));
  const saved = await Media.insertMany(files);
  res.status(201).json(saved);
});

router.get('/media', requireAuth(ROLES.ALL), async (req, res) => {
  const q = {};
  if (req.query.tag && req.query.tag !== 'All') q.tag = req.query.tag;
  if (req.query.q) q.$or = [{ name: new RegExp(req.query.q, 'i') }, { alt: new RegExp(req.query.q, 'i') }];
  res.json(await Media.find(q).sort({ createdAt: -1 }));
});

router.patch('/media/:id', requireAuth(ROLES.EDIT), async (req, res) => {
  const { alt, tag, name } = req.body;
  const set = {};
  if (alt !== undefined) set.alt = alt;
  if (tag !== undefined) set.tag = tag;
  if (name !== undefined) set.name = name;
  res.json(await Media.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }));
});

router.delete('/media/:id', requireAuth(ROLES.MEDIA_DELETE), async (req, res) => {
  const m = await Media.findByIdAndDelete(req.params.id);
  // Best-effort remove the file from disk if it lives under /uploads.
  if (m?.path?.startsWith('/uploads/')) {
    const abs = nodePath.resolve('uploads', nodePath.basename(m.path));
    fs.promises.unlink(abs).catch(() => {});
  }
  res.json({ ok: true });
});

/* ============================ USERS & ROLES ============================= */

router.get('/users', requireAuth(ROLES.MANAGE_USERS), async (_req, res) =>
  res.json(await User.find().select('email name role active createdAt').sort({ createdAt: -1 })));

router.post('/users', requireAuth(ROLES.MANAGE_USERS), async (req, res) => {
  const { email, name, role, password } = req.body;
  if (!email || !password) return res.status(422).json({ error: 'Email and password are required' });
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ error: 'A user with that email already exists' });
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ email: String(email).toLowerCase(), name, role: role || 'editor', passwordHash });
  res.status(201).json({ id: user._id, email: user.email, name: user.name, role: user.role, active: user.active });
});

router.patch('/users/:id', requireAuth(ROLES.MANAGE_USERS), async (req, res) => {
  const { name, role, active, password } = req.body;
  const set = {};
  if (name !== undefined) set.name = name;
  if (role !== undefined) set.role = role;
  if (active !== undefined) set.active = active;
  if (password) set.passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).select('email name role active');
  res.json(user);
});

router.delete('/users/:id', requireAuth(ROLES.MANAGE_USERS), async (req, res) => {
  if (String(req.user.sub) === String(req.params.id)) return res.status(400).json({ error: 'You cannot delete your own account' });
  await User.findByIdAndDelete(req.params.id);
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
