import { redis, isRedisAvailable } from '../config/redis';

const DEFAULT_TTL = 30; // seconds

export async function getCache<T>(key: string): Promise<T | null> {
    if (!isRedisAvailable()) return null;
    try {
        const raw = await redis!.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function setCache<T>(value: T, key: string, ttl: number = DEFAULT_TTL): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
        await redis!.setex(key, ttl, JSON.stringify(value));
    } catch {
        // silently fail
    }
}

export async function delCache(key: string): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
        await redis!.del(key);
    } catch {
        // silently fail
    }
}

export async function delCacheByPattern(pattern: string): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis!.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis!.del(...keys);
            }
        } while (cursor !== '0');
    } catch {
        // silently fail
    }
}

export async function wrapCache<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
): Promise<T> {
    if (!isRedisAvailable()) return fetcher();

    const cached = await getCache<T>(key);
    if (cached !== null) return cached;

    const data = await fetcher();
    await setCache(data, key, ttl);
    return data;
}
