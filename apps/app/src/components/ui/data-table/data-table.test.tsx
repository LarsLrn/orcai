import { afterEach, describe, expect, test } from "bun:test";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { createColumnHelper, type SortingState } from "@tanstack/react-table";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { memo } from "react";
import { DataTable } from "./data-table";
import { DataTableBody } from "./data-table-body";
import { DataTableColumnHeader } from "./data-table-column-header";
import { useTable } from "./data-table-context";
import { buildCsvRows } from "./data-table-csv";
import type { DataTableFeatures } from "./data-table-features";
import { DataTablePagination } from "./data-table-pagination";
import { createDataTableSelectColumn } from "./data-table-select-column";
import { DataTableViewOptions } from "./data-table-view-options";

type Item = {
	id: string;
	name: string;
	locked: boolean;
};

const items: Item[] = [
	{
		id: "1",
		name: "Alpha",
		locked: false,
	},
	{
		id: "2",
		name: "Beta, Inc.",
		locked: false,
	},
	{
		id: "3",
		name: "Gamma",
		locked: true,
	},
];

const columnHelper = createColumnHelper<DataTableFeatures, Item>();

// Model the compiler reusing a header when its column prop stays unchanged.
const MemoizedColumnHeader = memo(DataTableColumnHeader<Item, string>);

const columns = columnHelper.columns([
	createDataTableSelectColumn<Item>(),
	columnHelper.accessor("name", {
		header: ({ column }) => (
			<MemoizedColumnHeader column={column} title="Name" />
		),
		meta: {
			exportLabel: "Name",
		},
	}),
	columnHelper.accessor("id", {
		header: "ID",
	}),
	columnHelper.display({
		id: "actions",
		cell: () => "…",
	}),
]);

const CsvProbe = () => {
	const { table } = useTable<Item>();
	return <pre data-testid="csv">{JSON.stringify(buildCsvRows(table))}</pre>;
};

type Search = {
	pageIndex: number;
	pageSize: number;
	sort: SortingState;
};

const parseSearch = (raw: Record<string, unknown>): Search => ({
	pageIndex: Number(raw.pageIndex ?? 0),
	pageSize: Number(raw.pageSize ?? 20),
	sort: (raw.sort as SortingState | undefined) ?? [],
});

const renderTable = async ({
	data = items,
	search = "",
}: {
	data?: Item[];
	search?: string;
} = {}) => {
	const rootRoute = createRootRoute({
		validateSearch: parseSearch,
		component: () => {
			const { pageIndex, pageSize, sort } = rootRoute.useSearch() as Search;
			return (
				<DataTable
					data={data}
					columns={columns}
					state={{
						pagination: {
							pageIndex,
							pageSize,
						},
						sorting: sort,
					}}
					options={{
						rowCount: 50,
						uidAccessor: "id",
						enableRowSelection: (row) => !row.original.locked,
					}}
				>
					<DataTableViewOptions />
					<DataTableBody />
					<DataTablePagination />
					<CsvProbe />
				</DataTable>
			);
		},
	});
	const router = createRouter({
		routeTree: rootRoute,
		history: createMemoryHistory({
			initialEntries: [
				`/${search}`,
			],
		}),
	});
	render(<RouterProvider router={router} />);
	await screen.findByText("Rows per page");
	return router;
};

const currentSearch = (router: Awaited<ReturnType<typeof renderTable>>) =>
	router.state.location.search as Search;

afterEach(cleanup);

describe("DataTable", () => {
	test("renders a row per data item and an empty state", async () => {
		await renderTable();
		expect(screen.getByText("Alpha")).toBeTruthy();
		expect(screen.getByText("Gamma")).toBeTruthy();
		cleanup();

		await renderTable({
			data: [],
		});
		expect(screen.getByText("No results.")).toBeTruthy();
	});

	test("sorting updates the indicator and clears selection on the first page", async () => {
		const router = await renderTable({
			search: "?pageIndex=2",
		});
		const headerButton = screen.getByRole("button", {
			name: "Name",
		});

		fireEvent.click(screen.getByLabelText("Select all rows on this page"));
		fireEvent.click(headerButton);
		fireEvent.click(
			await screen.findByRole("menuitem", {
				name: "Desc",
			}),
		);

		await waitFor(() => {
			expect(currentSearch(router)).toEqual({
				pageIndex: 0,
				pageSize: 20,
				sort: [
					{
						id: "name",
						desc: true,
					},
				],
			});
		});
		expect(headerButton.querySelector(".lucide-arrow-down")).not.toBeNull();
		expect(
			screen.getByText("0 of 3 row(s) selected on this page."),
		).toBeTruthy();

		fireEvent.click(headerButton);
		fireEvent.click(
			await screen.findByRole("menuitem", {
				name: "Asc",
			}),
		);
		await waitFor(() => {
			expect(currentSearch(router).sort).toEqual([
				{
					id: "name",
					desc: false,
				},
			]);
		});
		expect(headerButton.querySelector(".lucide-arrow-up")).not.toBeNull();
	});

	test("pagination controls navigate between pages", async () => {
		const router = await renderTable();
		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Select all rows on this page"));

		fireEvent.click(
			screen.getByRole("button", {
				name: "Go to next page",
			}),
		);
		await waitFor(() => {
			expect(currentSearch(router).pageIndex).toBe(1);
		});
		expect(screen.getByText("Page 2 of 3")).toBeTruthy();
		expect(
			screen.getByText("0 of 3 row(s) selected on this page."),
		).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", {
				name: "Go to last page",
			}),
		);
		await waitFor(() => {
			expect(currentSearch(router).pageIndex).toBe(2);
		});
	});

	test("changing page size updates pagination", async () => {
		const router = await renderTable({
			search: "?pageIndex=2",
		});

		await act(() => {
			fireEvent.click(screen.getByRole("combobox"));
		});
		const pageSizeOption = await screen.findByRole("option", {
			name: "50",
		});
		await act(() => {
			fireEvent.keyDown(pageSizeOption, {
				key: "Enter",
			});
		});

		await waitFor(() => {
			expect(currentSearch(router)).toEqual({
				pageIndex: 0,
				pageSize: 50,
				sort: [],
			});
		});
		expect(screen.getByText("Page 1 of 1")).toBeTruthy();
	});

	test("select all only selects selectable rows", async () => {
		await renderTable();

		fireEvent.click(screen.getByLabelText("Select all rows on this page"));

		expect(
			screen.getByText("2 of 3 row(s) selected on this page."),
		).toBeTruthy();
		const rowCheckboxes = screen.getAllByLabelText("Select row");
		expect(
			rowCheckboxes.map((checkbox) => checkbox.getAttribute("aria-checked")),
		).toEqual([
			"true",
			"true",
			"false",
		]);
		expect(
			screen
				.getByLabelText("Select all rows on this page")
				.getAttribute("aria-checked"),
		).toBe("true");
	});

	test("view options hide a column from the table and CSV export", async () => {
		await renderTable();

		fireEvent.click(
			screen.getByRole("button", {
				name: "View",
			}),
		);
		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", {
				name: "name",
			}),
		);

		expect(screen.queryByText("Alpha")).toBeNull();
		expect(
			screen.queryByRole("button", {
				name: "Name",
			}),
		).toBeNull();
		expect(screen.getAllByLabelText("Select row")).toHaveLength(3);
		expect(JSON.parse(screen.getByTestId("csv").textContent ?? "")).toEqual([
			[
				"id",
			],
			[
				"1",
			],
			[
				"2",
			],
			[
				"3",
			],
		]);
	});

	test("csv rows use export labels and skip display columns", async () => {
		await renderTable();
		expect(JSON.parse(screen.getByTestId("csv").textContent ?? "")).toEqual([
			[
				"Name",
				"id",
			],
			[
				"Alpha",
				"1",
			],
			[
				"Beta, Inc.",
				"2",
			],
			[
				"Gamma",
				"3",
			],
		]);
	});
});
