import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import { paramlessReasonMessage } from "@/lib/errors/reason-messages";
import { m } from "@/paraglide/messages";

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
