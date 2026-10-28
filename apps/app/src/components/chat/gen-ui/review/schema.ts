import { z } from "zod/v4";

export const severitySchema = z.enum([
	"error",
	"warning",
	"info",
]);

export type Severity = z.infer<typeof severitySchema>;

const findingSchema = z.strictObject({
	label: z.string().describe("The rule or aspect, a few words of plain text."),
	severity: severitySchema.describe(
		"error: breaks the rule. warning: partly follows it or is doubtful. info: an observation that needs no change.",
	),
	note: z
		.string()
		.describe(
			"What is wrong and how to fix it. Markdown, <cite> citations allowed.",
		),
	excerpt: z
		.string()
		.optional()
		.describe(
			"The passage the finding refers to, copied exactly from the item's text so it can be found there. Leave out when the finding is about the text as a whole.",
		),
});

export const reviewSchema = z.strictObject({
	title: z.string().describe("Short heading, plain text."),
	summary: z
		.string()
		.optional()
		.describe(
			"A sentence or two on the overall result. Markdown, <cite> citations allowed.",
		),
	items: z
		.array(
			z.strictObject({
				label: z
					.string()
					.describe("Names the text, a few words of plain text."),
				text: z
					.string()
					.describe("The reviewed text, verbatim as the user gave it."),
				revised: z
					.string()
					.optional()
					.describe(
						"The corrected text, when a correction is useful. Plain text; mark italics with *asterisks*.",
					),
				findings: z
					.array(findingSchema)
					.describe(
						"Problems found in this text; an empty list when it follows every rule.",
					),
			}),
		)
		.describe("One entry per reviewed text."),
	general: z
		.array(findingSchema)
		.optional()
		.describe("Observations about all texts together, not tied to one text."),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
