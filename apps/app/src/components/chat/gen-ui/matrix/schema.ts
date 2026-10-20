import { z } from "zod/v4";
import { statusSchema } from "@/components/chat/gen-ui/status";

export const matrixSchema = z.object({
	title: z.string().optional().describe("Short heading, plain text."),
	columns: z
		.array(
			z.object({
				key: z.string().describe("Identifies the column in each row's cells."),
				label: z
					.string()
					.describe("The criterion, a word or two of plain text."),
			}),
		)
		.describe("One column per criterion, in display order."),
	rows: z
		.array(
			z.object({
				label: z
					.string()
					.describe("The checked item, a few words of plain text."),
				cells: z
					.record(
						z.string(),
						z.object({
							status: statusSchema.describe(
								"Outcome of the check. met: fully satisfied. partial: partly satisfied. not_met: not satisfied. n_a: cannot be checked.",
							),
							note: z
								.string()
								.optional()
								.describe(
									"Why the item misses the criterion and how to fix it. Markdown, <cite> citations allowed. Shown only when the status is other than met.",
								),
						}),
					)
					.describe("One cell per column, keyed by the column's key."),
			}),
		)
		.describe("One row per checked item."),
});

export type MatrixInput = z.infer<typeof matrixSchema>;
