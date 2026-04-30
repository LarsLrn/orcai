import { z } from "zod/v4";

export const searchFilterSchema = z.object({
	search: z.string().optional(),
});
