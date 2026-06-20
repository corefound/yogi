import { z } from 'zod'


export class GlobalZodSchema {

    static evironmentVariables = z.object({
        SESSION_SECRET_SECRET_KEY: z.string(),
        ZERO_ENCRYPTION_KEY: z.string(),
        QUEUE_SERVER_URL: z.string(),
        NOTIFICATION_SERVER_URL: z.string(),
        ZERO_SIGN_PRIVATE_KEY: z.string(),
        ZERO_SIGN_PUBLIC_KEY: z.string(),
        REDIS_HOST: z.string(),
        REDIS_PORT: z.string(),
        PORT: z.string(),
        LOKI_USERNAME: z.string(),
        LOKI_PASSWORD: z.string(),
        LOKI_URL: z.string(),
    })
}
