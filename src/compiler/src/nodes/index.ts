import { ZodSchemas } from "../schemas";
import { z } from "zod";

type LiteralNode = z.infer<typeof ZodSchemas.LiteralTypeSchema>;

export { 
    type LiteralNode
 };

