import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { get } from './db.js';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 64), expected);
}

export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '30d' });

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    const payload = jwt.verify(token, SECRET);
    const user = get('SELECT id, role, email FROM users WHERE id = ?', payload.sub);
    if (!user) throw new Error('unknown user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again.' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Not allowed for this account type.' });

// Small in-memory limiter for login/registration attempts.
const hits = new Map();
export function rateLimit(max, windowMs) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.ip;
    const t = Date.now();
    const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
    recent.push(t);
    hits.set(key, recent);
    if (recent.length > max) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    next();
  };
}
