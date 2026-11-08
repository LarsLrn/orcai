import { UploadIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import {
	requestUploadOutputSchema,
	type requestUploadTool,
} from "./request-upload";

export const requestUpload = declareTool<typeof requestUploadTool>()({
	kind: "client",
	group: "bots",
	capabilities: [
		"create_asset",
	],
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

/** The assets a saved upload lists under its summary line; none for an output that does not fit. */
export const uploadedAssets = (output: unknown) => {
	const parsed = requestUploadOutputSchema.safeParse(output).data;
	return parsed?.status === "saved" ? parsed.assets : [];
};
