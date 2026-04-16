import { z } from "zod/v4";

export const statusResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
});

export function createDataResponseSchema<TSchema extends z.ZodType>(
	dataSchema: TSchema,
) {
	return z.object({
		data: dataSchema,
	});
}

export function createListResponseSchema<TItemSchema extends z.ZodType>(
	itemSchema: TItemSchema,
) {
	return z.object({
		data: z.array(itemSchema),
		rowCount: z.number(),
	});
}

export function createDeleteResponseSchema() {
	return statusResponseSchema;
}
