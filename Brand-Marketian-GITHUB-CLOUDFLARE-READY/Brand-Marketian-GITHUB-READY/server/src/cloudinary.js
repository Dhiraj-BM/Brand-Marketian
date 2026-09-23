/* Brand Marketian — Cloudinary media storage.

   When CLOUDINARY_URL is set (cloudinary://<api_key>:<api_secret>@<cloud_name>,
   copied from the Cloudinary console → Settings → API Keys), CMS media uploads
   go to Cloudinary instead of MongoDB GridFS and are served from Cloudinary's
   CDN. Without it, uploads keep using GridFS (storage.js), so nothing breaks.

   Uses Cloudinary's signed REST upload API directly, so no SDK dependency. */
import crypto from 'crypto';
import { config } from './config.js';

function parse(url) {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(String(url || '').trim());
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
}

const creds = parse(config.cloudinary.url);
export const cloudinaryEnabled = !!creds;

// Cloudinary signature: sha1 of the sorted "k=v&k=v" params + the API secret.
function sign(params) {
  const str = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '').sort()
    .map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(str + creds.apiSecret).digest('hex');
}

async function call(path, form) {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${path}`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Cloudinary: ' + (json.error?.message || res.status));
  return json;
}

// Upload a buffer. Resolves with { url, publicId, resourceType, width, height }.
export async function uploadToCloudinary({ buffer, filename, mime }) {
  const params = {
    folder: config.cloudinary.folder,
    timestamp: Math.floor(Date.now() / 1000),
    use_filename: 'true',
    unique_filename: 'true'
  };
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  form.append('api_key', creds.apiKey);
  form.append('signature', sign(params));
  form.append('file', new Blob([buffer], { type: mime || 'application/octet-stream' }), filename || 'file');
  const r = await call('auto/upload', form);
  return { url: r.secure_url, publicId: r.public_id, resourceType: r.resource_type, width: r.width, height: r.height };
}

// Best-effort delete; never throws.
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!creds || !publicId) return;
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  Object.entries(params).forEach(([k, v]) => form.append(k, String(v)));
  form.append('api_key', creds.apiKey);
  form.append('signature', sign(params));
  try { await call(`${resourceType}/destroy`, form); } catch { /* already gone */ }
}
