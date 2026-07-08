import { z } from "zod/v4";

export const createSortingInputSchema = <
	TSortKeySchema extends z.ZodType<string>,
>(
	sortKeySchema: TSortKeySchema,
) => {
	const sortingItemSchema = z.object({
		id: sortKeySchema,
		desc: z.coerce.boolean().default(false),
	});

	return z.object({
		sort: z.array(sortingItemSchema).default([]),
	});
};

export const sortingInputSchema = createSortingInputSchema(z.string().min(1));

export type SortingInput = z.infer<typeof sortingInputSchema>;
