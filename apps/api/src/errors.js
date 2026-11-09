export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'Recurso no encontrado') => new AppError(404, 'not_found', message);
export const forbidden = (message = 'No tienes permiso para esta acción') => new AppError(403, 'forbidden', message);
export const conflict = (code, message) => new AppError(409, code, message);
