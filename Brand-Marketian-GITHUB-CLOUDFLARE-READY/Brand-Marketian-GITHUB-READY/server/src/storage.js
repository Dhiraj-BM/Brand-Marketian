/* Brand Marketian — uploaded-file storage on MongoDB GridFS.

   Multer (upload.js) keeps each upload in memory; here we stream it into
   GridFS so it lives in the same database as everything else. This means
   uploaded media survives server restarts and redeploys — a host with an
   ephemeral filesystem (Render, Railway free tier, most PaaS) would
   otherwise drop every file, leaving the CMS pointing at dead /uploads URLs.

   Public URLs stay exactly the same shape ("/uploads/<name>"), served by the
   GET /uploads/:name route in index.js. */
import mongoose from 'mongoose';

const BUCKET_NAME = 'uploads';

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('storage: database connection not ready');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

// Turn an original filename into a unique, URL-safe stored name.
export function makeName(originalname) {
  return Date.now() + '-' + String(originalname || 'file').replace(/[^\w.\-]/g, '_');
}

// Stream a buffer into GridFS. Resolves with the stored filename.
export function saveFile({ buffer, filename, mime }) {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, { contentType: mime || 'application/octet-stream' });
    stream.on('error', reject);
    stream.on('finish', () => resolve(filename));
    stream.end(buffer);
  });
}

// Metadata for a stored file, or null if it does not exist.
export async function findFile(filename) {
  const files = await bucket().find({ filename }).limit(1).toArray();
  return files[0] || null;
}

// A readable stream of the file's bytes (pipe straight to the HTTP response).
export function downloadStream(filename) {
  return bucket().openDownloadStreamByName(filename);
}

// Best-effort delete. Silently does nothing if the file is already gone.
export async function deleteFile(filename) {
  const f = await findFile(filename);
  if (f) await bucket().delete(f._id);
}
