import * as Effect from "effect/Effect";
import { attention } from "@/lib/activity/attention";
import { runningRuns, type Viewer } from "@/lib/activity/runs";

/** What the activity indicator polls: running runs and how much needs the user. */
export const activitySummary = (viewer: Viewer) =>
	Effect.gen(function* () {
		const [running, needed] = yield* Effect.all(
			[
				runningRuns(viewer),
				attention(viewer),
			],
			{
				concurrency: "unbounded",
			},
		);
		return {
			running,
			attention: {
				suggestions: needed.suggestions.reduce(
					(total, entry) => total + entry.count,
					0,
				),
				failures: needed.failures.length,
			},
		};
	});
