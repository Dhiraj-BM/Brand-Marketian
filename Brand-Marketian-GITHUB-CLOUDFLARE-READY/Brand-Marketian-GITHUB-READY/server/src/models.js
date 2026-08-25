import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const LeadSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  company: { type: String, trim: true },
  services: [{ type: String }],
  budget: { type: String },
  message: { type: String },
  segment: { type: String, enum: ['d2c', 'b2b', 'local', 'other'], default: 'other' },
  source: { type: String, default: 'website' },
  page: { type: String },
  utm: { source: String, medium: String, campaign: String },
  status: { type: String, enum: ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'], default: 'new', index: true },
  owner: { type: String },
  notes: [{ body: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
LeadSchema.index({ createdAt: -1 });

const SubscriberSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  source: { type: String, default: 'footer' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const PostSchema = new Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  excerpt: String,
  cover: String,
  body: String,
  tag: { type: String, default: 'Playbook' },
  readMinutes: { type: Number, default: 5 },
  published: { type: Boolean, default: false, index: true },
  publishedAt: Date,
  seo: { title: String, description: String }
}, { timestamps: true });

const CaseStudySchema = new Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  client: String,
  industry: { type: String, index: true },
  service: String,
  segment: { type: String, enum: ['d2c', 'b2b', 'local'], default: 'd2c' },
  summary: String,
  metrics: [{ value: String, label: String }],
  challenge: String,
  approach: String,
  result: String,
  quote: { body: String, name: String, role: String },
  gallery: [String],
  published: { type: Boolean, default: false, index: true }
}, { timestamps: true });

const JobSchema = new Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  blurb: String,
  type: { type: String, default: 'Full-time' },
  location: { type: String, default: 'Delhi NCR · Hybrid' },
  experience: String,
  description: String,
  open: { type: Boolean, default: true, index: true }
}, { timestamps: true });

const ApplicationSchema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job' },
  roleTitle: String,
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  phone: String,
  portfolio: String,
  why: String,
  resumePath: String,
  status: { type: String, enum: ['new', 'screening', 'interview', 'offer', 'rejected'], default: 'new' }
}, { timestamps: true });

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: String,
  role: { type: String, enum: ['admin', 'editor', 'client'], default: 'admin' }
}, { timestamps: true });

const SiteContentSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true }, // 'home', 'pricing', ...
  data: { type: Schema.Types.Mixed, default: {} },
  updatedBy: String
}, { timestamps: true });

const MediaSchema = new Schema({
  name: String,
  path: String,
  mime: String,
  size: Number,
  tag: String
}, { timestamps: true });

export const SiteContent = model('SiteContent', SiteContentSchema);
export const Media = model('Media', MediaSchema);

export const Lead = model('Lead', LeadSchema);
export const Subscriber = model('Subscriber', SubscriberSchema);
export const Post = model('Post', PostSchema);
export const CaseStudy = model('CaseStudy', CaseStudySchema);
export const Job = model('Job', JobSchema);
export const Application = model('Application', ApplicationSchema);
export const User = model('User', UserSchema);
