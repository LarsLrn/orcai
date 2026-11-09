import { tool } from "ai";
import type { z } from "zod/v4";
import { toolInputSchema } from "@/lib/ai/tools/input-schema";
import type { NoToolContext } from "@/lib/ai/tools/tool-builders";
import {
	type RequestUploadOutput,
	requestUploadInputSchema,
	requestUploadOutputSchema,
} from "./request-upload.declaration";

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
		"Show the user an upload field in the conversation to add files as assets. The user uploads the files, reviews the list and chooses Continue, and the result holds the new assets, or status cancelled. It only adds the assets to the Library and puts none in a repository, so attach them afterwards with createRepository or updateRepository. After cancelled, call it again only when the user asks.",
	inputSchema: toolInputSchema(requestUploadInputSchema),
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
