import type {
	ActivityFailure,
	ActivityMember,
	ActivityRun,
	PipelineFailure,
} from "@orcai/schema";
import { metadataFieldLabels } from "@/lib/presentation/metadata-fields";
import { m } from "@/paraglide/messages";

const joined = (parts: readonly (string | null | undefined)[]) =>
	parts.filter(Boolean).join(" · ");

/** What the user started, as the entry's title: "Upload to Reading list". */
export const runTitle = (run: ActivityRun): string => {
	switch (run.kind) {
		case "upload":
			return run.repository
				? m.activity_run_upload_repository_title({
						repository: run.repository.name,
					})
				: m.activity_run_upload_library_title();
		case "fill_metadata":
			return m.activity_run_fill_metadata_title();
		case "suggest_metadata":
			return run.asset
				? m.activity_run_suggest_metadata_title({
						asset: run.asset.title,
					})
				: m.activity_run_suggest_metadata_fallback_title();
		case "retry":
			if (run.asset) {
				return m.activity_run_retry_asset_title({
					asset: run.asset.title,
				});
			}
			return run.repository
				? m.activity_run_retry_repository_title({
						repository: run.repository.name,
					})
				: m.activity_run_retry_title();
		case "export":
			return m.activity_run_export_title();
	}
};

/** How far a running entry is: "12 of 40 files ready". */
export const runProgress = (run: ActivityRun): string => {
	const { done, total } = run.progress;
	if (run.kind === "export") return m.activity_run_export_running();
	if (run.kind === "upload") {
		return total === 0
			? m.activity_run_uploading()
			: m.activity_run_upload_progress({
					done,
					total,
				});
	}
	return m.activity_run_progress({
		done,
		total,
	});
};

/** What a running entry does now, for the dashboard: "Preparing files". */
export const runStage = (run: ActivityRun): string => {
	switch (run.kind) {
		case "upload":
			return run.progress.total === 0
				? m.activity_run_uploading()
				: m.activity_stage_upload();
		case "fill_metadata":
		case "suggest_metadata":
			return m.activity_stage_metadata();
		case "retry":
			return m.activity_stage_retry();
		case "export":
			return m.activity_run_export_running();
	}
};

const stateLabels = {
	finished: m.activity_run_state_finished,
	failed: m.activity_run_state_failed,
	resolved: m.activity_run_state_resolved,
	expired: m.activity_run_state_expired,
} satisfies Record<Exclude<ActivityRun["state"], "running">, () => string>;

/** What a finished entry achieved: "40 files ready", "Updated 38 assets". */
export const runOutcome = (run: ActivityRun): string | undefined => {
	const { total, failed } = run.progress;
	if (run.state === "expired") return m.activity_run_export_expired();
	if (run.kind === "export") {
		return run.state === "failed" ? undefined : m.activity_run_export_ready();
	}
	if (total === 0) return undefined;
	if (run.state === "failed") {
		return total > 1
			? m.activity_run_failed_count({
					failed,
					total,
				})
			: undefined;
	}
	switch (run.kind) {
		case "upload":
			return m.activity_run_files_ready({
				count: total,
			});
		case "fill_metadata":
			return m.activity_run_metadata_updated({
				count: run.metadata?.updated ?? 0,
			});
		case "suggest_metadata":
			return m.activity_run_suggestion_ready();
		case "retry":
			return m.activity_run_assets_ready({
				count: total,
			});
	}
};

/** The entry's muted line: progress while it runs, then its state and outcome, and its organisation. */
export const runSummary = (run: ActivityRun) =>
	joined(
		run.state === "running"
			? [
					runProgress(run),
					run.organization?.name,
				]
			: [
					stateLabels[run.state](),
					runOutcome(run),
					run.organization?.name,
				],
	);

/** What a toast says ended: the work, where the entry's title is the action that started it. */
const toastWork = (run: ActivityRun): string => {
	switch (run.kind) {
		case "fill_metadata":
			return m.activity_toast_fill_metadata_work();
		case "retry":
			if (run.asset) {
				return m.activity_toast_retry_asset_work({
					asset: run.asset.title,
				});
			}
			return run.repository
				? m.activity_toast_retry_repository_work({
						repository: run.repository.name,
					})
				: m.activity_toast_retry_work();
		case "export":
			return m.activity_toast_export_work();
		case "upload":
		case "suggest_metadata":
			return runTitle(run);
	}
};

/** Work that is worth a toast when it ends: everything that covers more than one asset or takes a while on its own. */
const notableRun = (run: ActivityRun) =>
	run.kind === "upload" ||
	run.kind === "fill_metadata" ||
	run.kind === "export" ||
	run.progress.total > 1;

/** The toast for an entry that just ended, if it gets one: failures always, finished bulk work. */
export const runToast = (
	run: ActivityRun,
): {
	tone: "success" | "error";
	title: string;
	description: string;
} | null => {
	const description = joined([
		runOutcome(run),
		run.organization?.name,
	]);
	if (run.state === "failed") {
		return {
			tone: "error",
			title: m.activity_toast_failed({
				title: toastWork(run),
			}),
			description,
		};
	}
	if (
		(run.state === "finished" || run.state === "resolved") &&
		notableRun(run)
	) {
		return {
			tone: "success",
			title: m.activity_toast_finished({
				title: toastWork(run),
			}),
			description,
		};
	}
	return null;
};

/** The indicator's accessible name: "Activity, 2 running, 9 need your attention". */
export const activityLabel = ({
	running,
	attention,
}: {
	running: number;
	attention: number;
}) =>
	[
		m.activity_title(),
		running > 0
			? m.activity_trigger_running({
					count: running,
				})
			: null,
		attention > 0
			? m.activity_trigger_attention({
					count: attention,
				})
			: null,
	]
		.filter(Boolean)
		.join(", ");

/** A failure as the attention list names it: "scan.pdf was not prepared". */
export const failureTitle = (failure: ActivityFailure): string => {
	const asset = failure.asset?.title ?? m.activity_failure_asset_fallback();
	switch (failure.stage) {
		case "processing":
			return m.activity_failure_processing_title({
				asset,
			});
		case "metadata":
			return m.activity_failure_metadata_title({
				asset,
			});
		case "indexing":
			return m.activity_failure_indexing_title({
				asset,
				repository:
					failure.repository?.name ?? m.activity_failure_repository_fallback(),
			});
		case "export":
			return m.activity_failure_export_title();
	}
};

const failureReasons: Record<PipelineFailure, () => string> = {
	unsupported: m.pipeline_failure_unsupported,
	empty: m.pipeline_failure_empty,
	extraction: m.pipeline_failure_extraction,
	timeout: m.pipeline_failure_timeout,
	quota: m.pipeline_failure_quota,
	other: m.pipeline_failure_other,
	model: m.pipeline_failure_model,
	answer: m.pipeline_failure_answer,
	output_limit: m.pipeline_failure_output_limit,
	missing_extraction: m.pipeline_failure_missing_extraction,
};

/** A failure's muted line: its organisation and why it failed, when known. */
export const failureSummary = (failure: ActivityFailure) =>
	joined([
		failure.organization?.name,
		failure.failure ? failureReasons[failure.failure]() : null,
	]);

/** Where one asset of an entry stands. */
export type MemberStage =
	| "failed"
	| "processing"
	| "indexing"
	| "metadata"
	| "updated"
	| "unchanged"
	| "ready"
	| "stopped";

export const memberStage = (member: ActivityMember): MemberStage | null => {
	const states = [
		member.processing,
		member.metadata,
		member.indexing,
	];
	if (states.includes("failed")) return "failed";
	if (member.processing === "pending") return "processing";
	if (member.indexing === "pending") return "indexing";
	if (member.metadata === "pending") return "metadata";
	if (member.appliedFields) {
		return member.appliedFields.length > 0 ? "updated" : "unchanged";
	}
	if (states.includes("completed")) return "ready";
	if (states.includes("replaced")) return "stopped";
	return null;
};

export const memberStageLabels: Record<MemberStage, () => string> = {
	failed: m.asset_state_failed_label,
	processing: m.asset_state_processing_label,
	indexing: m.asset_state_indexing_label,
	metadata: m.activity_stage_metadata,
	updated: m.activity_member_updated,
	unchanged: m.activity_member_unchanged,
	ready: m.asset_state_ready_label,
	stopped: m.activity_member_stopped,
};

/** How many assets got each field, most first, and how many stayed unchanged: "Description 38 · Language 31 · 4 unchanged". */
export const fieldSummary = (
	fields: Readonly<Record<string, number>>,
	unchanged: number,
) =>
	joined([
		...Object.entries(fields)
			.sort(([, a], [, b]) => b - a)
			.map(
				([field, count]) =>
					`${metadataFieldLabels[field as keyof typeof metadataFieldLabels]?.() ?? field} ${count}`,
			),
		unchanged > 0
			? m.activity_members_unchanged({
					count: unchanged,
				})
			: null,
	]);
