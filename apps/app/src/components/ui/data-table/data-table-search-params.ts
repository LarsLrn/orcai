import { paginationInputSchema } from "@orcai/schema";
import type { PaginationState } from "@tanstack/react-table";
import { z } from "zod/v4";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/pager";

/** The `query` search param a data table search edits. */
export const dataTableQuerySchema = z.string().trim().max(100);

/** The paging search params; an invalid value falls back to the first page or the default size. */
export const paginationSearchShape = {
	pageIndex: paginationInputSchema.shape.pageIndex.unwrap().catch(0).default(0),
	pageSize: paginationInputSchema.shape.pageSize
		.unwrap()
		.catch(DEFAULT_PAGE_SIZE)
		.default(DEFAULT_PAGE_SIZE),
};

/** Search params after a pagination change. */
export const withPagination = <TSearch extends object>(
	search: TSearch,
	pagination: PaginationState,
) => ({
	...search,
	pageIndex: pagination.pageIndex,
	pageSize: pagination.pageSize,
});

/**
 * Search params after a sorting change. Sorting always resets to the first
 * page. Each route narrows the sort item ids, so the sort type is taken from
 * the search params rather than from TanStack's `SortingState`.
 */
export const withSorting = <
	TSearch extends {
		sort?: TSort;
	},
	TSort,
>(
	search: TSearch,
	sorting: TSort,
) => ({
	...search,
	pageIndex: 0,
	sort: sorting,
});

/** Search params after a search query change, back on the first page. */
export const withQuery = <TSearch extends object>(
	search: TSearch,
	query: string,
) => ({
	...search,
	pageIndex: 0,
	query,
});

/**
 * A table's search params at their defaults: the first page, unsorted and
 * unfiltered. Entity pages strip them so their links stay clean.
 */
export const dataTableSearchDefaults = {
	pageIndex: 0,
	pageSize: 20,
	sort: [],
	query: "",
};
