import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import type { ActivityRunId, OrganizationId } from "@orcai/core";
import type { ActivityRun } from "@orcai/schema";
import {
	focusManager,
	QueryClient,
	QueryObserver,
} from "@tanstack/react-query";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {
		activity: {
			summary: {
				queryOptions: <T extends object>(options: T) => ({
					queryKey: [
						"activity",
						"summary",
					],
					...options,
				}),
			},
		},
	},
}));

const { activitySummaryOptions } = await import("./activity-state");

const running = (id: string): ActivityRun => ({
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
});

/** Lets the summary fetch settle and its observers react. */
const settle = async () => {
	for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
};

/**
 * The header's indicator and the dashboard card, both mounted, on a server
 * that reports whatever `runs` holds.
 */
const mounted = async () => {
	const queryClient = new QueryClient();
	// What QueryClientProvider does: follow focus and connectivity.
	queryClient.mount();
	const server = {
		runs: [] as ActivityRun[],
		fetches: 0,
	};
	const options = {
		...activitySummaryOptions(),
		queryFn: () => {
			server.fetches += 1;
			return Promise.resolve({
				running: server.runs,
				attention: {
					suggestions: 0,
					failures: 0,
					revision: "none",
				},
			});
		},
	};
	const unsubscribe = [
		"header",
		"dashboard card",
	].map(() =>
		new QueryObserver(queryClient, options).subscribe(() => undefined),
	);
	await settle();
	return {
		queryClient,
		server,
		/** Moves the clock on and lets any poll it started finish. */
		wait: async (ms: number) => {
			jest.advanceTimersByTime(ms);
			await settle();
		},
		unmount: () => {
			for (const stop of unsubscribe) stop();
			queryClient.clear();
			queryClient.unmount();
		},
	};
};

beforeEach(() => {
	jest.useFakeTimers();
	focusManager.setFocused(true);
});

afterEach(() => {
	jest.useRealTimers();
	focusManager.setFocused(undefined);
});

describe("activity summary query", () => {
	test("the header and the dashboard card share one summary query", async () => {
		const page = await mounted();

		expect(page.server.fetches).toBe(1);
		expect(
			page.queryClient.getQueryCache().findAll({
				queryKey: activitySummaryOptions().queryKey,
			}),
		).toHaveLength(1);
		page.unmount();
	});

	test("polls every 3 s while something runs and once a minute otherwise", async () => {
		const page = await mounted();

		await page.wait(59_000);
		expect(page.server.fetches).toBe(1);
		page.server.runs = [
			running("run-1"),
		];
		await page.wait(1_000);
		expect(page.server.fetches).toBe(2);

		await page.wait(3_000);
		expect(page.server.fetches).toBe(3);
		page.server.runs = [];
		await page.wait(3_000);
		expect(page.server.fetches).toBe(4);

		await page.wait(57_000);
		expect(page.server.fetches).toBe(4);
		await page.wait(3_000);
		expect(page.server.fetches).toBe(5);
		page.unmount();
	});

	test("a hidden tab does not poll, and showing it again refetches at once", async () => {
		const page = await mounted();
		page.server.runs = [
			running("run-1"),
		];
		await page.wait(60_000);
		expect(page.server.fetches).toBe(2);

		focusManager.setFocused(false);
		await page.wait(10 * 60_000);
		expect(page.server.fetches).toBe(2);

		focusManager.setFocused(true);
		await settle();
		expect(page.server.fetches).toBe(3);
		page.unmount();
	});

	test("focusing the window refetches even a fresh summary", async () => {
		const page = await mounted();

		focusManager.setFocused(false);
		focusManager.setFocused(true);
		await settle();
		expect(page.server.fetches).toBe(2);
		page.unmount();
	});
});
