import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rateLimit.js';
import { login } from '../services/auth.js';
import { email } from '../validation.js';

const loginSchema = z.object({ email, password: z.string().min(1).max(72) });

export function authRoutes(context, requireAuth) {
  const router = Router();
  const limiter = rateLimit(context, {
    name: 'login',
    limit: context.config.loginRateLimit,
    key: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  });

  router.post('/login', limiter, async (req, res) => {
    res.json({ token: await login(context, loginSchema.parse(req.body)) });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
