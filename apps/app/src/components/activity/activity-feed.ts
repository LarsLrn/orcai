import type { ActivityRun } from "@orcai/schema";
import { runToast } from "@/lib/presentation/activity";
import { claimToasts } from "./claim-toasts";

type Summary = {
	running: readonly ActivityRun[];
	attention: {
		revision: string;
	};
};

/** As many runs as `activity.runs` takes by id. */
export const ENDED_BATCH = 50;

export type RunToast = NonNullable<ReturnType<typeof runToast>> & {
	runId: ActivityRun["id"];
};

/**
 * Follows the polled summaries: refreshes the lists when work starts, ends
 * or needs the user, and toasts the runs that ended since the last summary.
 * The first summary only sets the baseline, so a mount toasts nothing old.
 * Ended runs that could not be fetched are asked for again with the next summary.
 */
export const activityFeed = (effects: {
	/** The runs as they ended, at most {@link ENDED_BATCH} at a time. */
	ended: (runIds: ActivityRun["id"][]) => Promise<readonly ActivityRun[]>;
	toast: (shown: RunToast) => void;
	refresh: () => void;
}) => {
	let seen: {
		running: ReadonlySet<ActivityRun["id"]>;
		signature: string;
	} | null = null;
	const pending = new Set<ActivityRun["id"]>();

	return async (summary: Summary) => {
		const running = new Set(summary.running.map((run) => run.id));
		const signature = JSON.stringify([
			[
				...running,
			].sort(),
			summary.attention.revision,
		]);
		const previous = seen;
		seen = {
			running,
			signature,
		};
		if (!previous) return;
		if (previous.signature !== signature) effects.refresh();

		for (const id of previous.running) {
			if (!running.has(id)) pending.add(id);
		}
		if (pending.size === 0) return;
		const ended = [
			...pending,
		];
		const runs = await Promise.all(
			Array.from(
				{
					length: Math.ceil(ended.length / ENDED_BATCH),
				},
				(_, batch) =>
					effects.ended(
						ended.slice(batch * ENDED_BATCH, (batch + 1) * ENDED_BATCH),
					),
			),
		);
		const toasts = runs.flat().flatMap((run) => {
			const shown = runToast(run);
			return shown
				? [
						{
							runId: run.id,
							...shown,
						},
					]
				: [];
		});
		const claimed = new Set(
			await claimToasts(toasts.map(({ runId }) => runId)),
		);
		for (const id of ended) pending.delete(id);
		for (const shown of toasts) {
			if (claimed.has(shown.runId)) effects.toast(shown);
		}
	};
};
