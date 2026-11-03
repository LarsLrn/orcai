import { describe, expect, test } from "bun:test";
import type { SortingState } from "@tanstack/react-table";
import { z } from "zod/v4";
import {
	paginationSearchShape,
	withPagination,
	withQuery,
	withSorting,
} from "./data-table-search-params";

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

describe("withQuery", () => {
	test("sets the query and resets to the first page", () => {
		const next = withQuery(
			{
				pageIndex: 4,
				pageSize: 20,
				providerId: "p1",
			},
			"abc",
		);

		expect(next).toEqual({
			pageIndex: 0,
			pageSize: 20,
			providerId: "p1",
			query: "abc",
		});
	});
});

describe("paginationSearchShape", () => {
	const parse = (search: object) =>
		z.object(paginationSearchShape).parse(search);

	test("defaults to the first page at the default size", () => {
		expect(parse({})).toEqual({
			pageIndex: 0,
			pageSize: 20,
		});
	});

	test("keeps valid values, including numeric strings", () => {
		expect(
			parse({
				pageIndex: "3",
				pageSize: 50,
			}),
		).toEqual({
			pageIndex: 3,
			pageSize: 50,
		});
	});

	test.each([
		-1,
		0.5,
		"0.5",
		1e100,
		"1e100",
		Number.MAX_SAFE_INTEGER,
		Number.POSITIVE_INFINITY,
		"abc",
		null,
		Number.NaN,
	])("falls back on an invalid page index %p", (pageIndex) => {
		expect(
			parse({
				pageIndex,
			}).pageIndex,
		).toBe(0);
	});

	test.each([
		0,
		-5,
		1.5,
		"1.5",
		5000,
		1e100,
		"abc",
		null,
	])("falls back on an invalid page size %p", (pageSize) => {
		expect(
			parse({
				pageSize,
			}).pageSize,
		).toBe(20);
	});
});
