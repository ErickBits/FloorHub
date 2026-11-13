import { cacheKeys, rooms } from '@floorhub/shared';
import { AppError } from '../errors.js';

// Construye un UPDATE solo con los campos enviados; los nombres de columna vienen de este código.
export function buildUpdate(fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new AppError(400, 'empty_update', 'No hay cambios');
  return {
    assignments: entries.map(([column], index) => `${column} = $${index + 2}`).join(', '),
    values: entries.map(([, value]) => value),
  };
}

// Al cambiar el alcance se cierra el socket para que reconecte con las salas correctas.
export async function refreshUserAccess(context, userIds) {
  await context.cache.invalidate(...userIds.map(cacheKeys.userScope));
  for (const userId of userIds) {
    context.background(
      Promise.resolve(context.emitter.in(rooms.user(userId)).disconnectSockets(true)),
      'No se pudo desconectar al usuario',
    );
  }
}
