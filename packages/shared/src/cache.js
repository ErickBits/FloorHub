// Save and retrieve data from Redis cache. If Redis is unavailable, it falls back to PostgreSQL.
// save most common petitions to db in cache

export function createCache(redis, log) {
  return {
    // Si Redis falla, la consulta va directo a PostgreSQL: la caché nunca es requisito.
    async getOrSet(key, ttlSeconds, load) {
      try {
        //Esta en redis
        const cached = await redis.get(key);
        //lo Devuelve
        if (cached !== null) return JSON.parse(cached);
      } catch (error) {
        log.warn({ err: error.message, key }, 'Caché no disponible al leer');
      }
      // si no consulta a la base de datos
      const value = await load();
      try {
        //Guarda con caducidad
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (error) {
        log.warn({ err: error.message, key }, 'Caché no disponible al escribir');
      }
      return value;
    },

    //Si los datos cambian borra la copia vieja
    //Cuando getorset se ejecuta de nuevo guarda el dato nuevo
    async invalidate(...keys) {
      if (keys.length === 0) return;
      try {
        await redis.del(...keys);
      } catch (error) {
        log.warn({ err: error.message, keys }, 'Caché no disponible al invalidar');
      }
    },
  };
}

// Claves de caché para datos que cambian con frecuencia y no se pueden almacenar en memoria.
export const cacheKeys = {
  userScope: (userId) => `cache:user:${userId}:scope`,
  activeAnnouncements: (userId) => `cache:user:${userId}:announcements`,
  teams: () => 'cache:teams',
};
