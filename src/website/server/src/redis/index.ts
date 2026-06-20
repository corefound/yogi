import { REDIS_HOST, REDIS_PORT } from "../constants";
import KeyvRedis from "@keyv/redis";
import Redis from "ioredis";
import Keyv from "keyv";


export const connection = {
    host: "redis",
    port: 6379
}

export const redis = new Redis(connection)


export default new Redis({
    host: REDIS_HOST,
    port: Number(REDIS_PORT)
})

export const keyvRedis = new Keyv({
    store: new KeyvRedis({
        url: `redis://${REDIS_HOST}:${REDIS_PORT}`
    }),
});
