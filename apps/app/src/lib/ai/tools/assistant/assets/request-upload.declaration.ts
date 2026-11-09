import { uploadedAssetSchema } from "@orcai/schema";
import { UploadIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { requestUploadTool } from "./request-upload";

export const requestUploadInputSchema = z.strictObject({
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
		assets: z.array(uploadedAssetSchema).min(1),
	}),
	z.object({
		status: z.literal("cancelled"),
	}),
]);

export type RequestUploadOutput = z.infer<typeof requestUploadOutputSchema>;

export const requestUpload = declareTool<typeof requestUploadTool>()({
	kind: "client",
	group: "bots",
	capabilities: [
		"create_asset",
	],
	inputSchema: requestUploadInputSchema,
	outputSchema: requestUploadOutputSchema,
	icon: UploadIcon,
	name: () => m.assistant_tool_request_upload_name(),
	active: () => m.assistant_tool_request_upload_name(),
	line: ({ output }) => {
		if (!output) {
			return m.assistant_tool_request_upload_name();
		}

		return output.status === "saved"
			? m.assistant_tool_request_upload_summary_saved({
					count: output.assets.length,
				})
			: m.assistant_tool_request_upload_summary_cancelled();
	},
});

/** The assets a saved upload lists under its summary line. */
export const uploadedAssets = (output: RequestUploadOutput | undefined) =>
	output?.status === "saved" ? output.assets : [];
