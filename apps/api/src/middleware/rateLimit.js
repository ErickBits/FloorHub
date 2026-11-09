import { AppError } from '../errors.js';

// Ventana fija por minuto. Si Redis no responde se deja pasar: el rate limiting no debe
// dejar a todo el piso sin servicio.
export function rateLimit({ redis, log }, { name, limit, key }) {
  return async (req, res, next) => {
    const windowKey = `rl:${name}:${key(req)}:${Math.floor(Date.now() / 60000)}`;
    let count = 0;
    try {
      const results = await redis.multi().incr(windowKey).expire(windowKey, 120).exec();
      count = results[0][1];
    } catch (error) {
      log.warn({ err: error.message, name }, 'Rate limiting no disponible');
    }
    if (count > limit) {
      res.set('Retry-After', '60');
      throw new AppError(429, 'rate_limited', 'Demasiados intentos. Espera un minuto.');
    }
    next();
  };
}
