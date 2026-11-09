import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { signToken } from '@floorhub/shared';
import { AppError } from '../errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { email } from '../validation.js';

const loginSchema = z.object({ email, password: z.string().min(1).max(72) });

// Comparar contra un hash falso iguala el tiempo de respuesta si el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync('floorhub-dummy-password', 10);

export function authRoutes(context, requireAuth) {
  const router = Router();
  const limiter = rateLimit(context, {
    name: 'login',
    limit: context.config.loginRateLimit,
    key: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
  });

  router.post('/login', limiter, async (req, res) => {
    const credentials = loginSchema.parse(req.body);
    const { rows } = await context.pool.query(
      'SELECT id, password_hash, is_active FROM users WHERE lower(email) = $1',
      [credentials.email],
    );
    const user = rows[0];
    const matches = await bcrypt.compare(credentials.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.is_active || !matches) {
      throw new AppError(401, 'invalid_credentials', 'Correo o contraseña incorrectos');
    }
    res.json({ token: signToken(context.config, user.id) });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
