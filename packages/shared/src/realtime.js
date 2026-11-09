export const EVENTS = {
  announcementNew: 'announcement:new',
  announcementPublished: 'announcement:published',
  announcementAcknowledged: 'announcement:acknowledged',
  announcementReminder: 'announcement:reminder',
  helpCreated: 'help:created',
  helpClaimed: 'help:claimed',
  helpResolved: 'help:resolved',
  presenceChanged: 'presence:changed',
  presenceHeartbeat: 'presence:heartbeat',
};

export const rooms = {
  user: (userId) => `user:${userId}`,
  team: (teamId) => `team:${teamId}`,
  teamSupervisors: (teamId) => `team:${teamId}:supervisors`,
};

export const PRESENCE_HEARTBEAT_SECONDS = 15;
export const PRESENCE_TIMEOUT_SECONDS = 45;

const presenceKey = (teamId) => `presence:team:${teamId}`;

// Un conjunto ordenado por último heartbeat permite encontrar y expirar a los inactivos.
export async function markPresent(redis, teamIds, userId, now = Date.now()) {
  if (teamIds.length === 0) return;
  const pipeline = redis.pipeline();
  for (const teamId of teamIds) pipeline.zadd(presenceKey(teamId), now, userId);
  await pipeline.exec();
}

export async function markAbsent(redis, teamIds, userId) {
  if (teamIds.length === 0) return;
  const pipeline = redis.pipeline();
  for (const teamId of teamIds) pipeline.zrem(presenceKey(teamId), userId);
  await pipeline.exec();
}

export async function onlineUsers(redis, teamIds, now = Date.now()) {
  const threshold = now - PRESENCE_TIMEOUT_SECONDS * 1000;
  const pipeline = redis.pipeline();
  for (const teamId of teamIds) pipeline.zrangebyscore(presenceKey(teamId), threshold, '+inf');
  const results = await pipeline.exec();
  return [...new Set(results.flatMap(([error, members]) => (error ? [] : members)))];
}

// Limpia usuarios cuyo gateway murió sin avisar y devuelve quiénes expiraron.
export async function expirePresence(redis, now = Date.now()) {
  const threshold = now - PRESENCE_TIMEOUT_SECONDS * 1000;
  const expired = [];
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'presence:team:*', 'COUNT', 100);
    cursor = next;
    for (const key of keys) {
      const members = await redis.zrangebyscore(key, '-inf', `(${threshold}`);
      if (members.length === 0) continue;
      await redis.zrem(key, ...members);
      const teamId = key.slice('presence:team:'.length);
      for (const userId of members) expired.push({ teamId, userId });
    }
  } while (cursor !== '0');
  return expired;
}
