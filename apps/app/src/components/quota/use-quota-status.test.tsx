import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import type { ModelId, ProviderId, QuotaPoolId } from "@orcai/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

/** The models whose status the server was asked for, in order. */
const asked: unknown[] = [];

mock.module("@/lib/orpc/orpc", () =>
	scriptedOrpc({
		quota: {
			// A used-up pool whose period ends in a minute.
			status: (input) => {
				asked.push(input);
				return {
					data: {
						available: true,
						pool: {
							id: crypto.randomUUID() as QuotaPoolId,
							name: "Everyone",
							usedShare: 1,
							periodEndsAt: new Date(Date.now() + 60_000),
						},
					},
				};
			},
		},
	}),
);

const { useQuotaStatus } = await import("./use-quota-status");

afterEach(() => {
	cleanup();
	jest.useRealTimers();
	asked.length = 0;
});

const input = {
	providerId: crypto.randomUUID() as ProviderId,
	modelId: crypto.randomUUID() as ModelId,
};

/** Moves the clock on and lets any fetch it started reach the server. */
const wait = async (ms: number) => {
	act(() => {
		jest.advanceTimersByTime(ms);
	});
	for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
};

describe("useQuotaStatus", () => {
	test("reads the status again once its period has reset, without polling before", async () => {
		jest.useFakeTimers();
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					staleTime: Number.POSITIVE_INFINITY,
				},
			},
		});
		renderHook(() => useQuotaStatus(input), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			),
		});
		await wait(0);
		expect(asked).toEqual([
			input,
		]);

		await wait(59_000);
		expect(asked).toHaveLength(1);

		await wait(4_000);
		expect(asked).toEqual([
			input,
			input,
		]);
	});
});
