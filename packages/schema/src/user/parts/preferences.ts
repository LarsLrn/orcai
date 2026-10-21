import { z } from "zod/v4";

export const tourIdSchema = z.enum([
	"initialTour",
	"chatTour",
]);

export const tourStateSchema = z.enum([
	"completed",
	"skipped",
]);

export const preferencesSchema = z.object({
	tours: z.partialRecord(tourIdSchema, tourStateSchema).optional(),
});

export type UserPreferencesType = z.infer<typeof preferencesSchema>;
