import z from "zod/v4";

export const processingStatusSchema = z.enum([
	"pending",
	"active",
	"completed",
	"failed",
]);

export type ProcessingStatus = z.infer<typeof processingStatusSchema>;
