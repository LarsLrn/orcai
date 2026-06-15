import { z } from "zod/v4";
import { retrievalModeSchema } from "../primitives/retrieval-mode";

export const qdrantPlaygroundSearchSchema = z.object({
	search: z.string(),
	retrievalMode: retrievalModeSchema,
});

export type QdrantPlaygroundSearchSchemaType = z.infer<
	typeof qdrantPlaygroundSearchSchema
>;
