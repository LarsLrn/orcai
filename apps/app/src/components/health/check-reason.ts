import type { Check, CheckReason } from "@orcai/schema";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const count = (check: Check) => Number(check.params?.count ?? 0);

// One entry per reason; a reason without an entry does not compile.
const reasonMessages: Record<CheckReason, (check: Check) => string> = {
	DEPENDENCY_REACHABLE: () => m.check_reason_dependency_reachable(),
	DEPENDENCY_UNREACHABLE: () => m.check_reason_dependency_unreachable(),
	DEPENDENCY_TIMEOUT: () => m.check_reason_dependency_timeout(),
	DEPENDENCY_DEGRADED: () => m.check_reason_dependency_degraded(),
	WORKERS_RUNNING: (check) =>
		m.check_reason_workers_running({
			count: formatCount(count(check)),
		}),
	WORKERS_NOT_RUNNING: () => m.check_reason_workers_not_running(),
	MAIL_SMTP: () => m.check_reason_mail_smtp(),
	MAIL_LOG_ONLY: () => m.check_reason_mail_log_only(),
	MAIL_NOT_SENT_YET: () => m.check_reason_mail_not_sent_yet(),
	MAIL_DEAD: (check) =>
		m.check_reason_mail_dead({
			count: formatCount(count(check)),
		}),
	CONFIG_OK: () => m.check_reason_config_ok(),
	CONFIG_WARNINGS: (check) =>
		m.check_reason_config_warnings({
			count: formatCount(count(check)),
		}),
	PROVIDER_READY: () => m.check_reason_provider_ready(),
	PROVIDER_MISSING: () => m.check_reason_provider_missing(),
	CHAT_MODEL_READY: () => m.check_reason_chat_model_ready(),
	CHAT_MODEL_MISSING: () => m.check_reason_chat_model_missing(),
	CHAT_MODEL_CAPABILITIES_UNKNOWN: (check) =>
		m.check_reason_chat_model_capabilities_unknown({
			count: formatCount(count(check)),
		}),
	POOL_READY: () => m.check_reason_pool_ready(),
	POOL_MISSING: () => m.check_reason_pool_missing(),
	ASSISTANT_MODEL_READY: () => m.check_reason_assistant_model_ready(),
	ASSISTANT_MODEL_MISSING: () => m.check_reason_assistant_model_missing(),
	ASSISTANT_MODEL_UNUSABLE: () => m.check_reason_assistant_model_unusable(),
	ASSISTANT_POOL_READY: () => m.check_reason_assistant_pool_ready(),
	ASSISTANT_POOL_MISSING: () => m.check_reason_assistant_pool_missing(),
	UTILITY_MODEL_READY: () => m.check_reason_utility_model_ready(),
	UTILITY_MODEL_MISSING: () => m.check_reason_utility_model_missing(),
	MEMBERS_INVITED: () => m.check_reason_members_invited(),
	MEMBERS_NONE_INVITED: () => m.check_reason_members_none_invited(),
	COVERAGE_COMPLETE: () => m.check_reason_coverage_complete(),
	COVERAGE_GAPS: (check) =>
		m.check_reason_coverage_gaps({
			count: formatCount(count(check)),
		}),
};

export const checkReasonMessage = (check: Check) =>
	reasonMessages[check.reason](check);
