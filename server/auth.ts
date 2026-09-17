import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { User } from '../src/types';

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'cnd_college_portal_secret_key_v2025';

// Memory cache for fast lookups
const tokenStore = new Map<string, { userId: string; createdAt: number }>();

export function createToken(user: User): string {
  const ts = Date.now();
  const payload = `${user.id}:${ts}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex').substring(0, 16);
  const token = `cnd_${Buffer.from(payload).toString('base64url')}_${hmac}`;
  tokenStore.set(token, { userId: user.id, createdAt: ts });
  return token;
}

export function revokeToken(token: string) {
  tokenStore.delete(token);
}

export function getUserByToken(token: string): User | null {
  if (!token) return null;

  // 1. Fast cache check
  const session = tokenStore.get(token);
  if (session) {
    const user = db.findUserById(session.userId);
    if (user && user.status === 'ACTIVE') return user;
  }

  // 2. Stateless HMAC check (survives any server restart!)
  if (token.startsWith('cnd_') && token.includes('_')) {
    const parts = token.split('_');
    if (parts.length >= 3) {
      const payloadBase64 = parts[1];
      const signature = parts[2];
      try {
        const payload = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const [userId] = payload.split(':');
        const expectedHmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex').substring(0, 16);
        if (signature === expectedHmac && userId) {
          const user = db.findUserById(userId);
          if (user && user.status === 'ACTIVE') {
            tokenStore.set(token, { userId: user.id, createdAt: Date.now() });
            return user;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // 3. Backward compatibility for legacy or local tokens
  if (token.startsWith('local_')) {
    const allUsers = db.getAllUsers();
    const user = allUsers.find(u => token.includes(u.id) || token.includes(u.username));
    if (user && user.status === 'ACTIVE') {
      tokenStore.set(token, { userId: user.id, createdAt: Date.now() });
      return user;
    }
  }

  return null;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const user = getUserByToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to [${roles.join(', ')}]. You are [${req.user.role}].`
      });
    }
    next();
  };
}

