import { z } from "zod/v4";

export const paginationInputSchema = z.object({
	pageSize: z.coerce
		.number()
		.min(1, "Page size must be at least 1")
		.max(1000, "Page size must be at most 1000")
		.default(20),
	pageIndex: z.coerce.number().min(0).default(0),
});
