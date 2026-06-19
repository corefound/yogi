import { z } from "zod";

export const CreatePackageSchema = z.object({
    name: z.string().min(1).max(214),
    repoFullName: z.string().min(1).max(255),
    githubRepoId: z.number().int().positive(),
    ownerId: z.number().int().positive(),
    description: z.string().max(65535).optional().transform((n) => n ?? ""),
    readmeText: z.string().max(65535).optional().transform((n) => n ?? ""),
    license: z.string().max(100).optional().transform((n) => n ?? "MIT"),
    homepage: z.string().url().optional().or(z.literal("")),
    visibility: z.enum(["public", "private"]).default("public"),
});

export type CreatePackageInput = z.infer<typeof CreatePackageSchema>;
