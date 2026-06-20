import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });
}

export async function getRedis(): Promise<Redis> {
    if (!redis) {
        throw new Error('REDIS_URL not configured');
    }
    if (redis.status === 'end' || redis.status === 'close') {
        throw new Error('Redis connection unavailable');
    }
    return redis;
}

export { redis };
