import { z } from "zod";

export const CreatePackageVersionSchema = z.object({
    packageId: z.number().int().positive(),
    version: z.string().min(1).max(50),
    description: z.string().max(65535).optional().transform((n) => n ?? ""),
    readmeText: z.string().max(65535).optional().transform((n) => n ?? ""),
    license: z.string().max(100).optional().transform((n) => n ?? "MIT"),
    assetSizeBytes: z.number().int().positive().optional().default(0),
    status: z.enum(["active", "draft", "deprecated", "yanked"]).optional().default("active"),
});

export type CreatePackageVersionInput = z.infer<typeof CreatePackageVersionSchema>;

export const GetPackageVersionSchema = z.object({
    packageName: z.string().min(1).max(214),
    version: z.string().min(1).max(50),
});

export type GetPackageVersionInput = z.infer<typeof GetPackageVersionSchema>;