import type { ToolPart } from "@/components/chat/message/classify-turn";
import {
	type ToolCloseCode,
	toolCloseCode,
} from "@/lib/ai/utils/close-pending-tool-parts";
import { m } from "@/paraglide/messages";

export type ToolStatus =
	| "awaiting-approval"
	| "denied"
	| "failed"
	| "interrupted"
	| "running"
	| "skipped";

export const toolStatusLabel = (status: ToolStatus) => {
	switch (status) {
		case "awaiting-approval":
			return m.chat_work_log_tool_status_awaiting_approval();
		case "denied":
			return m.chat_work_log_tool_status_denied();
		case "failed":
			return m.chat_work_log_tool_status_failed();
		case "interrupted":
			return m.chat_work_log_tool_status_interrupted();
		case "running":
			return m.chat_work_log_tool_status_running();
		case "skipped":
			return m.chat_work_log_tool_status_skipped();
	}
};

export const isFailedStatus = (status: ToolStatus | null) =>
	status === "failed" || status === "denied";

const closedStatus = {
	superseded: "skipped",
	interrupted: "interrupted",
} as const satisfies Record<ToolCloseCode, ToolStatus>;

/**
 * A finished call has no status. Whether an unfinished call is still running
 * or was cut off by an ended turn is only known at the turn level.
 */
export const toolStatus = (
	part: ToolPart,
	running: boolean,
): ToolStatus | null => {
	switch (part.state) {
		case "output-available":
			return null;
		case "output-error": {
			const code = toolCloseCode(part.errorText);
			return code ? closedStatus[code] : "failed";
		}
		case "output-denied": {
			const code = toolCloseCode(part.approval.reason);
			return code ? closedStatus[code] : "denied";
		}
		case "approval-requested":
			return "awaiting-approval";
		default:
			return running ? "running" : "interrupted";
	}
};
