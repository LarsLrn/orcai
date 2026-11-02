import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const statusKey = [
	"instanceSettings",
	"embeddingsStatus",
];
let fetches = 0;

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {
		instanceSettings: {
			embeddingsStatus: {
				queryOptions: () => ({
					queryKey: statusKey,
					queryFn: async () => {
						fetches += 1;
						return {
							data: {
								configured: true,
								rebuilding: false,
							},
						};
					},
				}),
			},
		},
	},
}));

const { useEmbeddingsRebuilding } = await import("./use-embeddings-configured");

afterEach(() => {
	jest.useRealTimers();
});

describe("useEmbeddingsRebuilding", () => {
	test("keeps asking while search is complete, so a rebuild another admin starts shows up", async () => {
		jest.useFakeTimers();
		const queryClient = new QueryClient();
		const { result } = renderHook(() => useEmbeddingsRebuilding(), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			),
		});
		await waitFor(() => expect(fetches).toBe(1));
		expect(result.current).toBe(false);

		jest.advanceTimersByTime(60_000);
		await waitFor(() => expect(fetches).toBe(2));
	});
});
