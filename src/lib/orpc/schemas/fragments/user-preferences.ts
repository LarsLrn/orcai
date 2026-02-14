import { z } from "zod/v4";

export const preferencesSchema = z.object({
	tours: z
		.object({
			initialTour: z.enum(["completed", "skipped"]).optional(),
			chatTour: z.enum(["completed", "skipped"]).optional(),
		})
		.optional(),
});

export type UserPreferencesType = z.infer<typeof preferencesSchema>;
