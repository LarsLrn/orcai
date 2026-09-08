import { z } from "zod/v4";

export const searchFilterSchema = z.object({
	// The term becomes an `ilike '%...%'` pattern, so it is bounded.
	search: z.string().max(200).optional(),
});
