import { describe, expect, test } from "bun:test";
import type { SortingState } from "@tanstack/react-table";
import { withPagination, withSorting } from "./data-table-search-params";

describe("withPagination", () => {
	test("replaces page index and size and keeps other params", () => {
		const next = withPagination(
			{
				pageIndex: 0,
				pageSize: 20,
				query: "abc",
			},
			{
				pageIndex: 3,
				pageSize: 50,
			},
		);

		expect(next).toEqual({
			pageIndex: 3,
			pageSize: 50,
			query: "abc",
		});
	});
});

describe("withSorting", () => {
	test("sets the sort and resets to the first page", () => {
		const sorting: SortingState = [
			{
				id: "name",
				desc: true,
			},
		];
		const next = withSorting(
			{
				pageIndex: 4,
				pageSize: 20,
				sort: [] as SortingState,
				query: "abc",
			},
			sorting,
		);

		expect(next).toEqual({
			pageIndex: 0,
			pageSize: 20,
			sort: sorting,
			query: "abc",
		});
	});
});
