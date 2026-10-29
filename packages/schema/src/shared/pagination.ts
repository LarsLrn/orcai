import { z } from "zod/v4";

const MAX_PAGE_SIZE = 1000;

export const paginationInputSchema = z.object({
	pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
	pageIndex: z.coerce
		.number()
		.int()
		.min(0)
		.max(Math.floor(Number.MAX_SAFE_INTEGER / MAX_PAGE_SIZE))
		.default(0),
});
