import Redis from 'ioredis';

const getRedis = () => {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error('KV_REDIS_URL is not set');
  return new Redis(url);
};

let redis: Redis | null = null;

export function getClient(): Redis {
  if (!redis) {
    redis = getRedis();
  }
  return redis;
}
