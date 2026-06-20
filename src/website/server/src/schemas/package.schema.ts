import { z } from "zod";

export const CreatePackageSchema = z.object({
    name: z.string().min(1).max(214),
    scope: z.string().max(100).optional().nullable(),
    fullName: z.string().min(1).max(320),
    description: z.string().max(65535).optional().nullable(),
    readmeText: z.string().max(65535).optional().nullable(),
    license: z.string().max(100).optional().nullable(),
    ownerUserId: z.number().int().positive().optional().nullable(),
    repositoryUrl: z.string().url().optional().nullable().or(z.literal("")),
    homepageUrl: z.string().url().optional().nullable().or(z.literal("")),
    documentationUrl: z.string().url().optional().nullable().or(z.literal("")),
    visibility: z.enum(["public", "private"]).default("public"),
});

export type CreatePackageInput = z.infer<typeof CreatePackageSchema>;

export const UpdatePackageSchema = z.object({
    description: z.string().max(65535).optional(),
    readmeText: z.string().max(65535).optional(),
    license: z.string().max(100).optional(),
    repositoryUrl: z.string().url().optional().nullable().or(z.literal("")),
    homepageUrl: z.string().url().optional().nullable().or(z.literal("")),
    documentationUrl: z.string().url().optional().nullable().or(z.literal("")),
    visibility: z.enum(["public", "private"]).optional(),
    status: z.enum(["active", "deprecated", "yanked", "unavailable"]).optional(),
});

export type UpdatePackageInput = z.infer<typeof UpdatePackageSchema>;

export const UpsertPackageSchema = CreatePackageSchema;
export type UpsertPackageInput = z.infer<typeof UpsertPackageSchema>;

export const GetPackageSchema = z.object({
    name: z.string().min(1).max(214),
});

export type GetPackageInput = z.infer<typeof GetPackageSchema>;
