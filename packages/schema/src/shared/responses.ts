import { z } from "zod/v4";
import { zedTokenMetaShape } from "./zed-token";

export const statusResponseSchema = z.object({
	success: z.boolean(),
	message: z.string().optional(),
	...zedTokenMetaShape,
});

export function createDataResponseSchema<TSchema extends z.ZodType>(
	dataSchema: TSchema,
) {
	return z.object({
		data: dataSchema,
		...zedTokenMetaShape,
	});
}

export function createListResponseSchema<TItemSchema extends z.ZodType>(
	itemSchema: TItemSchema,
) {
	return z.object({
		data: z.array(itemSchema),
		rowCount: z.number(),
		...zedTokenMetaShape,
	});
}

export function createDeleteResponseSchema() {
	return statusResponseSchema;
}
