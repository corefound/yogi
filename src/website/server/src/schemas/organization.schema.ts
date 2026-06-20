import { z } from "zod";

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1).max(100),
    displayName: z.string().max(255).optional().nullable(),
    description: z.string().optional().nullable(),
    avatarUrl: z.string().max(512).optional().nullable(),
    ownerUserId: z.number().int().positive(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z.object({
    displayName: z.string().max(255).optional(),
    description: z.string().optional(),
    avatarUrl: z.string().max(512).optional().nullable(),
    status: z.enum(["active", "suspended"]).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const GetOrganizationSchema = z.object({
    name: z.string().min(1).max(100),
});

export type GetOrganizationInput = z.infer<typeof GetOrganizationSchema>;
