/* zod validar datos**/
import { z } from 'zod';

/* Con zod validamos los datos que entran*/ 
const schema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_SSL_CA_FILE: z.string().optional(),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  HELP_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  REMINDER_MAX_ROUNDS: z.coerce.number().int().positive().default(5),
});

export function loadConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Configuración inválida: ${problems.join('; ')}`);
  }
  const value = result.data;
  return {
    env: value.NODE_ENV,
    logLevel: value.LOG_LEVEL,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    dbPoolMax: value.DB_POOL_MAX,
    dbSslCaFile: value.DB_SSL_CA_FILE,
    redisUrl: value.REDIS_URL,
    jwtSecret: value.JWT_SECRET,
    jwtExpiresIn: value.JWT_EXPIRES_IN,
    bcryptRounds: value.BCRYPT_ROUNDS,
    loginRateLimit: value.LOGIN_RATE_LIMIT_PER_MINUTE,
    helpRateLimit: value.HELP_RATE_LIMIT_PER_MINUTE,
    reminderMaxRounds: value.REMINDER_MAX_ROUNDS,
  };
}
