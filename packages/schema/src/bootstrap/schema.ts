import { z } from "zod/v4";

export const bootstrapStatusSchema = z.object({
	initialized: z.boolean(),
});

export type BootstrapStatus = z.infer<typeof bootstrapStatusSchema>;
