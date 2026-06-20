import { z } from "zod";

export const CreatePackageVersionSchema = z.object({
    packageId: z.number().int().positive(),
    version: z.string().min(1).max(50),
    description: z.string().max(65535).optional().nullable(),
    readmeText: z.string().max(65535).optional().nullable(),
    license: z.string().max(100).optional().nullable(),
    assetSizeBytes: z.number().int().optional(),
    status: z.string().max(20).optional(),
    publishedByUserId: z.number().int().positive().optional().nullable(),
});

export type CreatePackageVersionInput = z.infer<typeof CreatePackageVersionSchema>;

export const GetPackageVersionSchema = z.object({
    packageName: z.string().min(1).max(214),
    version: z.string().min(1).max(50),
});

export type GetPackageVersionInput = z.infer<typeof GetPackageVersionSchema>;

export const UpdatePackageVersionSchema = z.object({
    description: z.string().max(65535).optional(),
    readmeText: z.string().max(65535).optional(),
    license: z.string().max(100).optional(),
    assetSizeBytes: z.number().int().optional(),
    status: z.string().max(20).optional(),
});

export type UpdatePackageVersionInput = z.infer<typeof UpdatePackageVersionSchema>;
