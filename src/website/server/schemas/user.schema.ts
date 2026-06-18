import { z } from "zod";

export const CreateUserSchema = z.object({
    githubUserId: z.number().int().positive(),
    githubLogin: z.string().min(1).max(100),
    displayName: z.string().max(150).optional(),
    avatarUrl: z.string().max(512).optional(),
    profileUrl: z.string().max(512).optional(),
    email: z.string().max(255).optional(),
    role: z.enum(["user", "admin"]).optional().default("user"),
    status: z.enum(["active", "suspended", "deleted"]).optional().default("active"),
    lastLoginAt: z.date().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const GetUserSchema = z.object({
    name: z.string().min(1).max(100),
});

export type GetUserInput = z.infer<typeof GetUserSchema>;