import { UploadIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary, type SettledToolPart } from "../summary";

export const requestUploadSummary = defineToolSummary<"requestUpload">({
	icon: UploadIcon,
	name: () => m.assistant_tool_request_upload_name(),
	active: () => m.assistant_tool_request_upload_name(),
	line: (part) => {
		if (part.state !== "output-available") {
			return m.assistant_tool_request_upload_name();
		}

		return part.output.status === "saved"
			? m.assistant_tool_request_upload_summary_saved({
					count: part.output.assets.length,
				})
			: m.assistant_tool_request_upload_summary_cancelled();
	},
});

/** The assets a saved upload lists under its summary line. */
export const uploadedAssets = (part: SettledToolPart<"requestUpload">) =>
	part.state === "output-available" && part.output.status === "saved"
		? part.output.assets
		: [];
