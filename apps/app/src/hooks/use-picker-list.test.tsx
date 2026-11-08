import { afterEach, describe, expect, test } from "bun:test";
import {
	keepPreviousData,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePickerList } from "./use-picker-list";

const PAGE_SIZE = 2;

/** Items behind the list; a test may replace them between reads. */
let items: string[] = [];
/** Pages whose answer waits until the test releases it. */
let gate: Promise<void> | undefined;

const readPage = async ({
	pageIndex,
	search,
	filter,
}: {
	pageIndex: number;
	search: string | undefined;
	filter: string;
}) => {
	await gate;
	const rows = items.filter(
		(item) => item.startsWith(filter) && (!search || item.includes(search)),
	);
	return {
		data: rows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
		rowCount: rows.length,
	};
};

const renderPicker = (initial: { open?: boolean; filter?: string } = {}) => {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
	return renderHook(
		({ open = true, filter = "" }: { open?: boolean; filter?: string }) =>
			usePickerList({
				pageSize: PAGE_SIZE,
				open,
				queryOptions: (input) => ({
					// The app's list reads keep the previous page as placeholder.
					placeholderData: keepPreviousData,
					queryKey: [
						"items",
						filter,
						input,
					],
					queryFn: () =>
						readPage({
							...input,
							filter,
						}),
				}),
			}),
		{
			initialProps: initial,
			wrapper: ({ children }) => (
				<QueryClientProvider client={client}>{children}</QueryClientProvider>
			),
		},
	);
};

afterEach(() => {
	cleanup();
	gate = undefined;
});

describe("usePickerList", () => {
	test("the pager keeps its count and place while the next page loads", async () => {
		items = [
			"a1",
			"a2",
			"a3",
		];
		const { result } = renderPicker();
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a1",
				"a2",
			]),
		);
		expect(result.current.pager.pageCount).toBe(2);

		const release = Promise.withResolvers<void>();
		gate = release.promise;
		act(() => result.current.pager.onPageIndexChange(1));
		expect(result.current.pager).toMatchObject({
			pageIndex: 1,
			pageCount: 2,
			pending: true,
		});
		expect(result.current.rows).toEqual([]);

		await act(async () => release.resolve());
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a3",
			]),
		);
		expect(result.current.pager.pending).toBe(false);
	});

	test("a search shows no rows while typed and starts on the first page", async () => {
		items = [
			"a1",
			"a2",
			"a3",
			"b1",
		];
		const { result } = renderPicker();
		await waitFor(() => expect(result.current.pager.pageCount).toBe(2));
		act(() => result.current.pager.onPageIndexChange(1));
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a3",
				"b1",
			]),
		);

		act(() => result.current.setSearch("a"));
		expect(result.current.loading).toBe(true);
		expect(result.current.pager.pageIndex).toBe(0);
		await waitFor(() => expect(result.current.query).toBe("a"));
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a1",
				"a2",
			]),
		);
		expect(result.current.loading).toBe(false);
	});

	test("another filter is another list, read from its first page", async () => {
		items = [
			"a1",
			"a2",
			"a3",
			"b1",
		];
		const { result, rerender } = renderPicker({
			filter: "a",
		});
		await waitFor(() => expect(result.current.pager.pageCount).toBe(2));
		act(() => result.current.pager.onPageIndexChange(1));
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a3",
			]),
		);

		rerender({
			filter: "b",
		});
		expect(result.current.pager).toMatchObject({
			pageIndex: 0,
			pageCount: 0,
		});
		expect(result.current.rows).toEqual([]);
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"b1",
			]),
		);
		expect(result.current.pager.pageCount).toBe(1);
	});

	test("a page past the end of a shrunk list moves to the last page", async () => {
		items = [
			"a1",
			"a2",
			"a3",
			"a4",
			"a5",
		];
		const { result } = renderPicker();
		await waitFor(() => expect(result.current.pager.pageCount).toBe(3));
		act(() => result.current.pager.onPageIndexChange(2));
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a5",
			]),
		);

		items = [
			"a1",
			"a2",
		];
		await act(() => result.current.list.refetch());
		await waitFor(() => expect(result.current.pager.pageIndex).toBe(0));
		await waitFor(() => expect(result.current.pager.pageCount).toBe(1));
		expect(result.current.rows).toEqual([
			"a1",
			"a2",
		]);
	});

	test("a closed picker forgets its search and page", async () => {
		items = [
			"a1",
			"a2",
			"a3",
		];
		const { result, rerender } = renderPicker();
		await waitFor(() => expect(result.current.pager.pageCount).toBe(2));
		act(() => result.current.pager.onPageIndexChange(1));
		act(() => result.current.setSearch("a"));
		act(() => result.current.pager.onPageIndexChange(1));

		rerender({
			open: false,
		});
		expect(result.current.search).toBe("");
		expect(result.current.query).toBeUndefined();
		expect(result.current.pager.pageIndex).toBe(0);

		items = [
			"a1",
		];
		rerender({
			open: true,
		});
		await waitFor(() =>
			expect(result.current.rows).toEqual([
				"a1",
			]),
		);
	});
});
