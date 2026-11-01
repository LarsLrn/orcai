import { z } from "zod/v4";
import { proseField } from "@/components/chat/gen-ui/prose";
import { statusSchema } from "@/components/chat/gen-ui/status";

export const checklistSchema = z.strictObject({
	title: z.string().optional().describe("Short heading, plain text."),
	description: z
		.string()
		.optional()
		.describe("One sentence on what was checked, plain text."),
	items: z
		.array(
			z.strictObject({
				label: z
					.string()
					.describe("The criterion or point, a few words of plain text."),
				status: statusSchema
					.optional()
					.describe(
						"Outcome of the check. met: fully satisfied. partial: partly satisfied. not_met: not satisfied. n_a: cannot be checked. Leave out for a plain list of expandable points.",
					),
				summary: z
					.string()
					.optional()
					.describe(
						"One-line plain-text summary, visible while the row is collapsed.",
					),
				body: proseField(
					"Explanation shown when the row is expanded.",
				).optional(),
				quote: z
					.string()
					.optional()
					.describe(
						"A verbatim passage the item refers to, plain text, shown above the body.",
					),
			}),
		)
		.describe("One row per criterion or checked item."),
});

export type ChecklistInput = z.infer<typeof checklistSchema>;
