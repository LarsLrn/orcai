import type { PaginationState } from "@tanstack/react-table";
import { z } from "zod/v4";

/** The `query` search param a data table search edits. */
export const dataTableQuerySchema = z.string().trim().max(100);

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
