import { z } from "zod/v4";

export const retrievalModeSchema = z.enum([
	"hybrid",
	"dense",
	"sparse",
]);

export type RetrievalMode = z.infer<typeof retrievalModeSchema>;
