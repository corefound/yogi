import { GlobalZodSchema } from "../zod";

const evironmentVariables = GlobalZodSchema.evironmentVariables.parse(process.env)
export const {
    PORT,
    REDIS_HOST,
    REDIS_PORT,
    SESSION_SECRET_SECRET_KEY,
    ZERO_ENCRYPTION_KEY,
    NOTIFICATION_SERVER_URL,
    ZERO_SIGN_PRIVATE_KEY,
    ZERO_SIGN_PUBLIC_KEY,
    QUEUE_SERVER_URL,
    LOKI_URL,
    LOKI_USERNAME,
    LOKI_PASSWORD

} = evironmentVariables
