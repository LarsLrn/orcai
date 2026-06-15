import { z } from "zod/v4";

export const groupKindSchema = z.enum([
	"system",
	"custom",
]);

export type GroupKind = z.infer<typeof groupKindSchema>;
