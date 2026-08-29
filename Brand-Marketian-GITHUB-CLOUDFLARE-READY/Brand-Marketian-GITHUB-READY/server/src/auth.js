import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function sign(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, email: user.email, name: user.name }, config.jwtSecret, { expiresIn: '7d' });
}

/* Role groups used across CMS endpoints. Kept here so permissions live in one place. */
export const ROLES = {
  ALL: ['super_admin', 'admin', 'editor', 'designer', 'viewer', 'client'], // any signed-in user
  EDIT: ['super_admin', 'admin', 'editor', 'designer'],                     // edit + save drafts + submit
  PUBLISH: ['super_admin', 'admin'],                                        // approve + publish
  MEDIA_DELETE: ['super_admin', 'admin'],
  MANAGE_USERS: ['super_admin'],
  // Legacy default: staff-level access for existing endpoints (leads, stats, ...).
  STAFF: ['super_admin', 'admin', 'editor', 'designer']
};

export function requireAuth(roles = ROLES.STAFF) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (!roles.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}
