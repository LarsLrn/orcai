import { afterEach, describe, expect, jest, mock, spyOn, test } from "bun:test";
import type { ModelId, ProviderId, QuotaPoolId } from "@orcai/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

const statusKey = ({ input }: { input: unknown }) => [
	"quota",
	"status",
	input,
];

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		quota: {
			status: {
				queryKey: statusKey,
				queryOptions: (options: { input: unknown }) => ({
					queryKey: statusKey(options),
					queryFn: () => Promise.reject(new Error("No server in unit tests")),
				}),
			},
		},
	},
}));

const { useQuotaStatus } = await import("./use-quota-status");

afterEach(() => {
	jest.useRealTimers();
});

const input = {
	providerId: crypto.randomUUID() as ProviderId,
	modelId: crypto.randomUUID() as ModelId,
};

/** A composer showing a used-up pool whose period ends in a minute. */
const exhaustedComposer = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
	const queryKey = statusKey({
		input,
	});
	queryClient.setQueryData(queryKey, {
		data: {
			available: true,
			pool: {
				id: crypto.randomUUID() as QuotaPoolId,
				name: "Everyone",
				usedShare: 1,
				periodEndsAt: new Date(Date.now() + 60_000),
			},
		},
	});
	const invalidate = spyOn(
		queryClient,
		"invalidateQueries",
	).mockResolvedValue();
	renderHook(() => useQuotaStatus(input), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		),
	});
	return {
		invalidate,
		queryKey,
	};
};

describe("useQuotaStatus", () => {
	test("reads the status again once its period has reset, without polling before", () => {
		jest.useFakeTimers();
		const { invalidate, queryKey } = exhaustedComposer();

		jest.advanceTimersByTime(59_000);
		expect(invalidate).not.toHaveBeenCalled();

		jest.advanceTimersByTime(4_000);
		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(invalidate.mock.calls[0]?.[0]).toEqual({
			queryKey,
			exact: true,
		});
	});
});
