import type { ToolPart } from "@/components/chat/message/classify-turn";
import { isClientToolPart } from "@/lib/ai/tools/assistant/client-tools";
import {
	type ToolCloseCode,
	toolCloseCode,
} from "@/lib/ai/utils/close-pending-tool-parts";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import { paramlessReasonMessage } from "@/lib/errors/reason-messages";
import { m } from "@/paraglide/messages";

export type ToolStatus =
	| "approved"
	| "awaiting-approval"
	| "awaiting-input"
	| "denied"
	| "failed"
	| "interrupted"
	| "running"
	| "skipped";

export const toolStatusLabel = (status: ToolStatus) => {
	switch (status) {
		case "approved":
			return m.chat_work_log_tool_status_approved();
		case "awaiting-approval":
			return m.chat_work_log_tool_status_awaiting_approval();
		case "awaiting-input":
			return m.chat_work_log_tool_status_awaiting_input();
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
 * or was cut off by an ended turn is only known at the turn level. A client
 * call still waits only on the `latest` message; elsewhere it was skipped.
 */
export const toolStatus = (
	part: ToolPart,
	running: boolean,
	latest = false,
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
		case "approval-responded":
			if (!part.approval.approved) return "denied";
			return running ? "running" : "approved";
		default:
			if (running) return "running";
			if (part.state === "input-available" && isClientToolPart(part)) {
				return latest ? "awaiting-input" : "skipped";
			}
			return "interrupted";
	}
};

const REASON_PREFIX = /^([A-Z][A-Z0-9_]*): /;

/**
 * A failed call's error text translated through its leading reason code, or
 * the generic failure for a reason whose message needs params.
 */
export const toolErrorMessage = (
	errorText: string | undefined,
): string | undefined => {
	const code = errorText?.match(REASON_PREFIX)?.[1];

	if (!isErrorReason(code)) {
		return undefined;
	}

	return paramlessReasonMessage(code) ?? m.error_ai_tool_failed();
};
