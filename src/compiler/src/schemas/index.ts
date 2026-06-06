import { z } from "zod";



export class ZodSchemas {
    static DiagnosticsSchema = z.object({
        kind: z.string(),
        category: z.string(),
        message: z.string(),
        position: z.object({
            line: z.number(),
            character: z.number(),
        }),
        source: z.string().optional(),
        fileName: z.string(),
    });

    static LiteralTypeSchema = z.object({
        kind: z.string(),
        value: z.string(),
        source: z.string(),
        position: z.object({
            line: z.number(),
            character: z.number(),
        }),
    })

}


