import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	QueryClient,
	QueryClientProvider,
	queryOptions,
	useQuery,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const toastError = mock(() => undefined);
mock.module("sonner", () => ({
	toast: {
		error: toastError,
	},
}));

const { openFreshUrl } = await import("./open-fresh-url");

const realOpen = window.open;

const stubTab = () => {
	const tab = {
		location: {
			href: "",
		},
		close: mock(() => undefined),
	};
	window.open = mock(() => tab) as unknown as typeof window.open;
	return tab;
};

beforeEach(() => {
	toastError.mockClear();
});

afterEach(() => {
	window.open = realOpen;
});

describe("openFreshUrl", () => {
	test("navigates the tab opened on click to the refreshed url", async () => {
		const tab = stubTab();
		const refetch = mock(async () => ({
			isError: false,
			data: {
				url: "https://files.test/fresh",
			},
		}));

		await openFreshUrl(refetch);

		expect(window.open).toHaveBeenCalledTimes(1);
		expect(refetch).toHaveBeenCalledTimes(1);
		expect(tab.location.href).toBe("https://files.test/fresh");
		expect(tab.close).not.toHaveBeenCalled();
	});

	test("opens the tab before the url resolves to keep the click's popup permission", async () => {
		const tab = stubTab();
		let opened = false;

		await openFreshUrl(() => {
			opened = (window.open as ReturnType<typeof mock>).mock.calls.length > 0;
			return Promise.resolve({
				isError: false,
				data: {
					url: "https://files.test/fresh",
				},
			});
		});

		expect(opened).toBe(true);
		expect(tab.location.href).toBe("https://files.test/fresh");
	});

	test("closes the tab and reports an error when the refetch rejects", async () => {
		const tab = stubTab();

		await openFreshUrl(() => Promise.reject(new Error("offline")));

		expect(tab.close).toHaveBeenCalledTimes(1);
		expect(tab.location.href).toBe("");
		expect(toastError).toHaveBeenCalledTimes(1);
	});

	test("reports an error without fetching when the popup is blocked", async () => {
		window.open = mock(() => null) as unknown as typeof window.open;
		const refetch = mock(async () => ({
			isError: false,
			data: {
				url: "https://files.test/fresh",
			},
		}));

		await openFreshUrl(refetch);

		expect(refetch).not.toHaveBeenCalled();
		expect(toastError).toHaveBeenCalledTimes(1);
	});

	test("never opens the cached url once the refetch is refused", async () => {
		const tab = stubTab();
		let calls = 0;
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
		const download = queryOptions({
			queryKey: [
				"download",
			],
			queryFn: () => {
				calls += 1;
				return calls > 1
					? Promise.reject(new Error("FORBIDDEN"))
					: Promise.resolve({
							url: "https://files.test/stale",
						});
			},
		});
		const { result } = renderHook(() => useQuery(download), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			),
		});
		await waitFor(() =>
			expect(result.current.data?.url).toBe("https://files.test/stale"),
		);

		await openFreshUrl(result.current.refetch);

		expect(result.current.data?.url).toBe("https://files.test/stale");
		expect(tab.location.href).toBe("");
		expect(tab.close).toHaveBeenCalledTimes(1);
		expect(toastError).toHaveBeenCalledTimes(1);
	});
});
