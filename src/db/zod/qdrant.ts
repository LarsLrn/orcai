import { z } from "zod/v4";

export const qdrantPlaygroundSearchSchema = z.object({
	search: z.string(),
});

export type QdrantPlaygroundSearchSchemaType = z.infer<
	typeof qdrantPlaygroundSearchSchema
>;
