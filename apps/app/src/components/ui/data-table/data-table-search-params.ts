import type { PaginationState } from "@tanstack/react-table";

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
