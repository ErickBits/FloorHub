import { z } from 'zod';
import { AppError } from '../errors.js';

// Traduce restricciones de PostgreSQL a respuestas claras, sin revelar detalles internos.
const PG_ERRORS = {
  23505: [409, 'already_exists', 'Ya existe un registro con esos datos'],
  23503: [422, 'invalid_reference', 'Una referencia no existe o está en uso'],
  23514: [422, 'invalid_state', 'Los datos no cumplen las reglas del sistema'],
};

export function errorHandler(log) {
  return (error, req, res, _next) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Datos inválidos',
          details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        },
      });
    }
    if (error instanceof AppError) {
      return res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (PG_ERRORS[error.code]) {
      const [status, code, message] = PG_ERRORS[error.code];
      return res.status(status).json({ error: { code, message } });
    }
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Cuerpo de la petición inválido' } });
    }
    log.error({ err: error, path: req.path, method: req.method }, 'Error no controlado');
    return res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
  };
}
