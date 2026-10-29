import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { ActivityRunId, OrganizationId } from "@orcai/core";
import type { ActivityRun } from "@orcai/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";

const runs =
	mock<
		(input: { ids: ActivityRunId[] }) => Promise<{
			data: ActivityRun[];
		}>
	>();

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {
		activity: {
			runs,
		},
	},
	orpc: {
		activity: {
			runs: {
				key: () => [
					"activity",
					"runs",
				],
			},
			attention: {
				key: () => [
					"activity",
					"attention",
				],
			},
			runMembers: {
				key: () => [
					"activity",
					"runMembers",
				],
			},
		},
	},
}));

const { useActivityFeed } = await import("./use-activity-feed");

type FeedQuery = Parameters<typeof useActivityFeed>[0];

const originalGetLocale = getLocale;

beforeEach(() => {
	overwriteGetLocale(() => "en");
	runs.mockReset();
});

afterEach(() => {
	overwriteGetLocale(originalGetLocale);
});

const run = (id: ActivityRunId, state: ActivityRun["state"]): ActivityRun => ({
	id,
	kind: "upload",
	state,
	createdAt: new Date(),
	organization: {
		id: "org-1" as OrganizationId,
		name: "Methods Lab",
	},
	repository: null,
	asset: null,
	progress: {
		total: 2,
		done: state === "running" ? 1 : 2,
		failed: 0,
	},
	metadata: null,
	dataExport: null,
});

const summaryOf = (running: ActivityRun[]) => ({
	running,
	attention: {
		revision: "none",
	},
});

describe("useActivityFeed", () => {
	test("a poll that returns the same summary retries ended runs whose fetch failed", async () => {
		const id = crypto.randomUUID() as ActivityRunId;
		const success = spyOn(toast, "success");
		runs.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
			data: [
				run(id, "finished"),
			],
		});
		const queryClient = new QueryClient();
		const idle = summaryOf([]);
		const { rerender } = renderHook<void, FeedQuery>(
			(query) => useActivityFeed(query),
			{
				initialProps: {
					data: summaryOf([
						run(id, "running"),
					]),
					dataUpdatedAt: 1,
				},
				wrapper: ({ children }: { children: ReactNode }) => (
					<QueryClientProvider client={queryClient}>
						{children}
					</QueryClientProvider>
				),
			},
		);
		/** A summary fetch, and whatever the hook started on it. */
		const poll = (query: FeedQuery) =>
			act(async () => {
				rerender(query);
				await new Promise((resolve) => setTimeout(resolve, 0));
			});

		await poll({
			data: idle,
			dataUpdatedAt: 2,
		});
		expect(runs).toHaveBeenCalledTimes(1);
		expect(success).not.toHaveBeenCalled();

		// Structural sharing hands back the same summary object.
		await poll({
			data: idle,
			dataUpdatedAt: 3,
		});
		expect(runs).toHaveBeenCalledTimes(2);
		expect(success).toHaveBeenCalledTimes(1);
		expect(success.mock.calls[0]?.[0]).toBe("Upload to Library finished");
		success.mockRestore();
	});
});
