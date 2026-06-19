import { z } from "zod";

export const CreateInstallationSchema = z.object({
    packageId: z.number().int().positive(),
    packageVersionId: z.number().int().positive(),
    eventType: z.string().max(50),
    platform: z.string().max(50),
    arch: z.string().max(20),
    os: z.string().max(50),
    yogiVersion: z.string().max(50),
    status: z.string().max(20),
    sha256Matched: z.boolean(),
    releaseIdMatched: z.boolean(),
    assetNameMatched: z.boolean(),
    assetIdMatched: z.boolean(),
    assetSizeMatched: z.boolean(),
});

export type CreateInstallationInput = z.infer<typeof CreateInstallationSchema>;