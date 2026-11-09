import { authenticateToken } from '@floorhub/shared';
import { AppError, forbidden } from '../errors.js';

export function authenticate(context) {
  return async (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const user = scheme === 'Bearer' && token ? await authenticateToken(context, token) : null;
    if (!user) throw new AppError(401, 'unauthorized', 'Sesión inválida o expirada');
    req.user = user;
    next();
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
