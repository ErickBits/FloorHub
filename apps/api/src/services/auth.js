import bcrypt from 'bcrypt';
import { signToken } from '@floorhub/shared';
import { AppError } from '../errors.js';

// Comparar contra un hash falso iguala el tiempo de respuesta si el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync('floorhub-dummy-password', 10);

// Devuelve el JWT. El error es el mismo en todos los casos para no revelar qué correos existen.
export async function login({ pool, config }, credentials) {
  const { rows } = await pool.query(
    'SELECT id, password_hash, is_active FROM users WHERE lower(email) = $1',
    [credentials.email],
  );
  const user = rows[0];
  const matches = await bcrypt.compare(credentials.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.is_active || !matches) {
    throw new AppError(401, 'invalid_credentials', 'Correo o contraseña incorrectos');
  }
  return signToken(config, user.id);
}
