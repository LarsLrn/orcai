import z from "zod/v4";

export const publicationStatusSchema = z.enum([
	"draft",
	"ready",
]);

export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
