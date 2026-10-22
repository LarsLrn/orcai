import { z } from "zod/v4";

/** What `searchWeb` answers with, as the browser reads it back. */
export const searchWebOutputSchema = z.object({
	results: z.array(
		z.object({
			url: z.string(),
			title: z.string(),
			content: z.string(),
		}),
	),
});

export type SearchWebOutput = z.infer<typeof searchWebOutputSchema>;
