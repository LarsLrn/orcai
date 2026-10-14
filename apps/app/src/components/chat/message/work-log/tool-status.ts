import type { ToolPart } from "@/components/chat/message/classify-turn";
import { m } from "@/paraglide/messages";

export type ToolStatus =
	| "awaiting-approval"
	| "denied"
	| "failed"
	| "incomplete"
	| "running";

export const toolStatusLabel = (status: ToolStatus) => {
	switch (status) {
		case "awaiting-approval":
			return m.chat_work_log_tool_status_awaiting_approval();
		case "denied":
			return m.chat_work_log_tool_status_denied();
		case "failed":
			return m.chat_work_log_tool_status_failed();
		case "incomplete":
			return m.chat_work_log_tool_status_incomplete();
		case "running":
			return m.chat_work_log_tool_status_running();
	}
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
