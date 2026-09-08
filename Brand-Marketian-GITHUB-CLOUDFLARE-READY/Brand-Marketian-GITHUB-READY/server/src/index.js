import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { config } from './config.js';
import { connectDb } from './db.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { findFile, downloadStream } from './storage.js';

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

// Uploaded media lives in MongoDB GridFS (see storage.js), not on local disk,
// so it survives restarts and redeploys. URLs stay as "/uploads/<name>".
app.get('/uploads/:name', async (req, res, next) => {
  try {
    const file = await findFile(req.params.name);
    if (!file) return res.status(404).json({ error: 'Not found' });
    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=604800',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = downloadStream(req.params.name);
    stream.on('error', () => { res.headersSent ? res.destroy() : res.status(404).end(); });
    stream.pipe(res);
  } catch (e) { next(e); }
});
app.use(express.static(path.resolve('public')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

connectDb().then(() => {
  app.listen(config.port, () => console.log('[api] http://localhost:' + config.port));
});
