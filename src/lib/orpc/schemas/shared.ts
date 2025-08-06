import { z } from "zod/v4";

export const paginationSchema = z.object({
	pageSize: z.coerce.number().int().min(1).max(100).default(10),
	pageIndex: z.coerce.number().int().min(0).default(0),
});

export const statusSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
});
