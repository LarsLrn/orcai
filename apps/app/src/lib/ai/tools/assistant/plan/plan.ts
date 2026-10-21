import { z } from "zod/v4";

const planItemStatusSchema = z.enum([
	"pending",
	"in_progress",
	"done",
	"skipped",
]);

export const planSchema = z.object({
	title: z
		.string()
		.min(1)
		.max(200)
		.describe("The task in a few words, plain text."),
	items: z
		.array(
			z.object({
				label: z
					.string()
					.min(1)
					.max(200)
					.describe("The step's name in a few words, plain text."),
				details: z
					.string()
					.min(1)
					.max(1000)
					.optional()
					.describe(
						"The step's specifics, such as names, settings or contents, plain text.",
					),
				status: planItemStatusSchema,
			}),
		)
		.min(1)
		.max(20)
		.describe("Every step, in order."),
});

export type Plan = z.infer<typeof planSchema>;
export type PlanItemStatus = z.infer<typeof planItemStatusSchema>;
