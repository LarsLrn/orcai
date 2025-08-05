import { z } from "zod/v4";

export const paginationSchema = z.object({
	pageSize: z.number().int().min(1).max(100).default(10),
	pageIndex: z.number().int().min(0).default(0),
});
