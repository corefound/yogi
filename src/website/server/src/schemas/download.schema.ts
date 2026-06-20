import { z } from "zod";

export const RecordDownloadSchema = z.object({
    packageId: z.number().int().positive(),
});

export type RecordDownloadInput = z.infer<typeof RecordDownloadSchema>;

export const GetDownloadStatsSchema = z.object({
    packageId: z.number().int().positive().optional(),
    period: z.enum(["week", "month", "all"]).optional().default("week"),
});

export type GetDownloadStatsInput = z.infer<typeof GetDownloadStatsSchema>;
