import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ActivityRunId, OrganizationId } from "@orcai/core";
import type { ActivityRun } from "@orcai/schema";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { activityFeed, type RunToast } from "./activity-feed";

const originalGetLocale = getLocale;

beforeEach(() => {
	overwriteGetLocale(() => "en");
	localStorage.clear();
});

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

const run = (
	id: string,
	overrides: Partial<ActivityRun> = {},
): ActivityRun => ({
	id: id as ActivityRunId,
	kind: "upload",
	state: "running",
	createdAt: new Date(),
	organization: {
		id: "org-1" as OrganizationId,
		name: "Methods Lab",
	},
	repository: null,
	asset: null,
	progress: {
		total: 2,
		done: 1,
		failed: 0,
	},
	metadata: null,
	dataExport: null,
	...overrides,
});

const summaryOf = (running: ActivityRun[], revision = "none") => ({
	running,
	attention: {
		revision,
	},
});

/** A feed as one tab or mount runs it, recording what it did. */
const feedOf = (
	endedRuns: readonly ActivityRun[],
	{
		failures = 0,
	}: {
		/** How many fetches of ended runs fail first. */
		failures?: number;
	} = {},
) => {
	const asked: ActivityRunId[][] = [];
	const toasts: RunToast[] = [];
	let refreshes = 0;
	let failing = failures;
	const observe = activityFeed({
		ended: (runIds) => {
			asked.push(runIds);
			if (failing > 0) {
				failing -= 1;
				return Promise.reject(new Error("offline"));
			}
			return Promise.resolve(
				endedRuns.filter((ended) => runIds.includes(ended.id)),
			);
		},
		toast: (shown) => toasts.push(shown),
		refresh: () => {
			refreshes += 1;
		},
	});
	return {
		observe,
		asked,
		toasts,
		refreshes: () => refreshes,
	};
};

const finishedRun = (id: string) =>
	run(id, {
		state: "finished",
		progress: {
			total: 2,
			done: 2,
			failed: 0,
		},
	});

describe("activityFeed", () => {
	test("toasts a run once it leaves the running ones", async () => {
		const finished = finishedRun(crypto.randomUUID());
		const feed = feedOf([
			finished,
		]);
		await feed.observe(
			summaryOf([
				run(finished.id),
			]),
		);
		await feed.observe(summaryOf([]));

		expect(feed.asked).toEqual([
			[
				finished.id,
			],
		]);
		expect(feed.toasts).toEqual([
			{
				runId: finished.id,
				tone: "success",
				title: "Upload to Library finished",
				description: "2 files ready · Methods Lab",
			},
		]);
	});

	test("a later mount that sees the same run end shows no second toast", async () => {
		const finished = finishedRun(crypto.randomUUID());
		const first = feedOf([
			finished,
		]);
		const second = feedOf([
			finished,
		]);
		await Promise.all(
			[
				first,
				second,
			].map(async (feed) => {
				await feed.observe(
					summaryOf([
						run(finished.id),
					]),
				);
				await feed.observe(summaryOf([]));
			}),
		);

		expect(first.toasts.length + second.toasts.length).toBe(1);
	});

	test("the first summary only sets the baseline", async () => {
		const feed = feedOf([
			finishedRun(crypto.randomUUID()),
		]);
		await feed.observe(summaryOf([]));
		await feed.observe(summaryOf([]));

		expect(feed.asked).toEqual([]);
		expect(feed.refreshes()).toBe(0);
	});

	test("refreshes the lists when work starts or what needs the user changes, also at the same count", async () => {
		const feed = feedOf([]);
		await feed.observe(summaryOf([]));
		await feed.observe(summaryOf([], "one failure"));
		await feed.observe(summaryOf([], "another failure"));
		await feed.observe(
			summaryOf(
				[
					run("run-2"),
				],
				"another failure",
			),
		);
		await feed.observe(
			summaryOf(
				[
					run("run-2"),
				],
				"another failure",
			),
		);

		expect(feed.refreshes()).toBe(3);
		expect(feed.toasts).toEqual([]);
	});

	test("runs whose fetch failed are toasted with the next summary", async () => {
		const ended = finishedRun(crypto.randomUUID());
		const feed = feedOf(
			[
				ended,
			],
			{
				failures: 1,
			},
		);
		await feed.observe(
			summaryOf([
				run(ended.id),
			]),
		);
		await expect(feed.observe(summaryOf([]))).rejects.toThrow("offline");
		expect(feed.toasts).toEqual([]);

		await feed.observe(summaryOf([]));
		expect(feed.asked).toEqual([
			[
				ended.id,
			],
			[
				ended.id,
			],
		]);
		expect(feed.toasts.map((shown) => shown.runId)).toEqual([
			ended.id,
		]);

		await feed.observe(summaryOf([]));
		expect(feed.asked).toHaveLength(2);
	});

	test("asks for ended runs in batches the server takes", async () => {
		const ended = Array.from(
			{
				length: 51,
			},
			() => finishedRun(crypto.randomUUID()),
		);
		const feed = feedOf(ended);
		await feed.observe(summaryOf(ended.map((entry) => run(entry.id))));
		await feed.observe(summaryOf([]));

		expect(feed.asked.map((ids) => ids.length)).toEqual([
			50,
			1,
		]);
		expect(feed.toasts).toHaveLength(51);
	});
});
