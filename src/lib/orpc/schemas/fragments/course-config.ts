import { z } from "zod/v4";

export const configSchema = z.object({
	systemPrompt: z.string(),
	maxReferences: z.number().min(1).max(20),
	model: z.string(),
});

export type CourseConfigType = z.infer<typeof configSchema>;
