import { z } from "zod";

export const CreateMetricSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.number().int().nonnegative(),
    label: z.string().max(255).optional().nullable(),
    body: z.any().optional().nullable(),
});

export type CreateMetricInput = z.infer<typeof CreateMetricSchema>;

export const UpdateMetricSchema = z.object({
    value: z.number().int().nonnegative().optional(),
    label: z.string().max(255).optional(),
    body: z.any().optional().nullable(),
});

export type UpdateMetricInput = z.infer<typeof UpdateMetricSchema>;
