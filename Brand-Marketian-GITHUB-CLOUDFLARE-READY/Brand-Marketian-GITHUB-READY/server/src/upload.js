import multer from 'multer';

/* Files are held in memory here and then streamed into MongoDB GridFS by
   storage.js. The host's local disk is never used, so uploads survive
   redeploys and cold starts (Render and similar hosts wipe the filesystem). */
const ALLOWED_MIME = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4'
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.includes(file.mimetype))
});
