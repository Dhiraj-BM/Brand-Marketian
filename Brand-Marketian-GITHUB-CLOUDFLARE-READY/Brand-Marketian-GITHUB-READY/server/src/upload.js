import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve('uploads');
fs.mkdirSync(dir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.\-]/g, '_'))
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4'
  ].includes(file.mimetype))
});
