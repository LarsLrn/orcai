import type { ToolPart } from "@/components/chat/message/classify-turn";

export type ToolStatus =
	| "awaiting-approval"
	| "denied"
	| "failed"
	| "incomplete"
	| "running";

export const toolStatusLabels: Record<ToolStatus, string> = {
	"awaiting-approval": "Awaiting approval",
	denied: "Denied",
	failed: "Failed",
	incomplete: "Not completed",
	running: "Running",
};

export const isFailedStatus = (status: ToolStatus | null) =>
	status === "failed" || status === "denied";

/**
 * A finished call has no status. Whether an unfinished call is still running
 * or was orphaned by an ended turn is only known at the turn level.
 */
export const toolStatus = (
	part: ToolPart,
	running: boolean,
): ToolStatus | null => {
	switch (part.state) {
		case "output-available":
			return null;
		case "output-error":
			return "failed";
		case "output-denied":
			return "denied";
		case "approval-requested":
			return "awaiting-approval";
		default:
			return running ? "running" : "incomplete";
	}
};
