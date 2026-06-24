import Redis from 'ioredis';
import KeyvRedis from "@keyv/redis";
import Keyv from "keyv";

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;
let redisAvailable = false;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
        enableOfflineQueue: false,
    });

    redis.on('error', (err: Error) => {
        console.error('[redis] connection error:', err.message);
        redisAvailable = false;
    });

    redis.on('connect', () => {
        redisAvailable = true;
    });

    redis.on('ready', () => {
        redisAvailable = true;
    });

    redis.on('close', () => {
        redisAvailable = false;
    });

    redis.on('end', () => {
        redisAvailable = false;
    });
}

export const keyvRedis = new Keyv({
    store: new KeyvRedis({
        url: REDIS_URL
    }),
});


export function isRedisAvailable(): boolean {
    return redis !== null && redisAvailable;
}

export async function getRedis(): Promise<Redis> {
    if (!redis || !redisAvailable) {
        throw new Error('Redis not available');
    }
    return redis;
}

export { redis };
