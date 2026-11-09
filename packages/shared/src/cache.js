export function createCache(redis, log) {
  return {
    // Si Redis falla, la consulta va directo a PostgreSQL: la caché nunca es requisito.
    async getOrSet(key, ttlSeconds, load) {
      try {
        const cached = await redis.get(key);
        if (cached !== null) return JSON.parse(cached);
      } catch (error) {
        log.warn({ err: error.message, key }, 'Caché no disponible al leer');
      }
      const value = await load();
      try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (error) {
        log.warn({ err: error.message, key }, 'Caché no disponible al escribir');
      }
      return value;
    },

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

export const cacheKeys = {
  userScope: (userId) => `cache:user:${userId}:scope`,
  activeAnnouncements: (userId) => `cache:user:${userId}:announcements`,
  teams: () => 'cache:teams',
};
