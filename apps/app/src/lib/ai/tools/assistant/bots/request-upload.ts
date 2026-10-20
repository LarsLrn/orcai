import { assetIdSchema } from "@orcai/schema";
import { tool } from "ai";
import { z } from "zod/v4";
import type { NoToolContext } from "../procedure-tool";

export const requestUploadInputSchema = z.object({
	reason: z
		.string()
		.min(1)
		.describe(
			"One line shown above the upload field, such as: Upload the style guides for the repository 'APA rules'.",
		),
});

export const requestUploadOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("saved"),
		assets: z
			.array(
				z.object({
					id: assetIdSchema,
					title: z.string().min(1),
				}),
			)
			.min(1),
	}),
	z.object({
		status: z.literal("cancelled"),
	}),
]);

export type RequestUploadOutput = z.infer<typeof requestUploadOutputSchema>;

/** Saved assets are not in any repository yet; the model reads that with the ids. */
export const SAVED_UPLOAD_NEXT_STEP =
	"Attach them to a repository with createRepository or updateRepository.";

/** A client tool: the browser answers it through the upload widget. */
export const requestUploadTool = tool<
	z.infer<typeof requestUploadInputSchema>,
	RequestUploadOutput,
	NoToolContext
>({
	description:
		"Show the user an upload field in the conversation to add files as assets. It only creates assets: it never attaches them to a repository. Returns the ids and titles of the saved assets, or status cancelled. To put the files in a repository, attach them afterwards with createRepository or updateRepository. After cancelled, do not call it again unless the user asks.",
	inputSchema: requestUploadInputSchema,
	outputSchema: requestUploadOutputSchema,
	toModelOutput: ({ output }) => ({
		type: "json",
		value:
			output.status === "saved"
				? {
						status: output.status,
						attached: false,
						assets: output.assets,
						next: SAVED_UPLOAD_NEXT_STEP,
					}
				: output,
	}),
});
