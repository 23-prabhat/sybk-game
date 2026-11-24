export function redisStore(redis) {
  const read = async (key) => {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  };
  return {
    read,
    async write(key, value, ttl) {
      await redis.set(key, JSON.stringify(value), ttl ? { expiration: new Date(Date.now() + ttl) } : undefined);
    },
    async update(keys, decide) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const tx = await redis.watch(...keys);
        let queued = false;
        let executed = false;
        try {
          const existing = await Promise.all(keys.map(read));
          const change = decide(existing);
          if (!change.commands.length) return change.value;
          await tx.multi();
          queued = true;
          for (const [method, ...args] of change.commands) await tx[method](...args);
          const result = await tx.exec();
          executed = true;
          if (Array.isArray(result) && result.length) return change.value;
        } finally {
          if (!executed) await (queued ? tx.discard() : tx.unwatch()).catch(() => {});
        }
      }
      throw new Error('Concurrent modification');
    },
    async leaderboard(key, member) {
      const options = { by: 'rank', reverse: true };
      const [rows, total, ownScore, ownIndex] = await Promise.all([
        redis.zRange(key, 0, 9, options),
        redis.zCard(key),
        member ? redis.zScore(key, member) : undefined,
        member ? redis.zRank(key, member) : undefined
      ]);
      let you = null;
      if (ownScore != null && ownIndex != null) {
        const [first] = await redis.zRange(key, ownScore, ownScore, { by: 'score', reverse: true, limit: { offset: 0, count: 1 } });
        const index = first ? await redis.zRank(key, first.member) : ownIndex;
        you = { score: ownScore, rank: Math.max(1, total - (index ?? ownIndex)) };
      }
      return { rows, total, you };
    }
  };
}

export const set = (key, value, ttl) => [
  'set', key, JSON.stringify(value), ttl ? { expiration: new Date(Date.now() + ttl) } : undefined
];
export const change = (value, ...commands) => ({ value, commands });

export function previewStore() {
  const values = new Map();
  const rankings = new Map();
  const read = (key) => {
    const entry = values.get(key);
    return entry && (!entry.expires || entry.expires > Date.now()) ? JSON.parse(entry.raw) : null;
  };
  const writeRaw = (key, raw, options) => values.set(key, { raw, expires: options?.expiration?.getTime() });
  const ranking = (key) => {
    if (!rankings.has(key)) rankings.set(key, new Map());
    return rankings.get(key);
  };
  const execute = {
    set: writeRaw,
    del: (key) => values.delete(key),
    zAdd: (key, entry) => ranking(key).set(entry.member, entry.score),
    zIncrBy: (key, user, points) => ranking(key).set(user, (ranking(key).get(user) ?? 0) + points),
    expire: () => {}
  };
  return {
    read: async (key) => read(key),
    write: async (key, value, ttl) => writeRaw(key, JSON.stringify(value), ttl ? { expiration: new Date(Date.now() + ttl) } : undefined),
    async update(keys, decide) {
      const result = decide(keys.map(read));
      for (const [method, ...args] of result.commands) execute[method](...args);
      return result.value;
    },
    async leaderboard(key, member) {
      const rows = [...ranking(key)].map(([name, score]) => ({ member: name, score })).sort((a, b) => b.score - a.score || a.member.localeCompare(b.member));
      const own = rows.find((row) => row.member === member);
      return {
        rows: rows.slice(0, 10), total: rows.length,
        you: own ? { score: own.score, rank: 1 + rows.filter((row) => row.score > own.score).length } : null
      };
    }
  };
}
