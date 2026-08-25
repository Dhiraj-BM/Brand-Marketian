import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { config } from './config.js';
import { connectDb } from './db.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', rateLimit({ windowMs: 60_000, limit: 60 }));
app.use('/api/leads', rateLimit({ windowMs: 10 * 60_000, limit: 8 }));

app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use('/uploads', express.static(path.resolve('uploads')));
app.use(express.static(path.resolve('public')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

connectDb().then(() => {
  app.listen(config.port, () => console.log('[api] http://localhost:' + config.port));
});
