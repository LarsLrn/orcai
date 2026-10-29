import type { LibrarySort } from "@orcai/schema";
import { FiltersDrawer, SortControl } from "@/components/browse/browse-filters";
import {
	BrowseResultsHeader,
	NoResults,
	TileGrid,
} from "@/components/browse/browse-layout";
import { CardPager, useClampedPageIndex } from "@/components/ui/card-pager";
import {
	activeFilterCount,
	type FilterDefinitions,
	type FilterValues,
} from "@/lib/browse/browse-search";

/**
 * One view's results: heading with the count, Filters (n) below `lg` and the
 * sort, then the tiles and the pager. With nothing to show, `empty` when
 * nothing is narrowed, and a "nothing matches" otherwise.
 */
export const BrowseResults = <D extends FilterDefinitions>({
	filters,
	search,
	onFilter,
	onSort,
	title,
	rowCount,
	actions,
	empty,
	children,
}: {
	filters: D;
	search: FilterValues<D> & {
		query: string;
		sort: LibrarySort;
		pageIndex: number;
		pageSize: number;
	};
	onFilter: (key: keyof D & string, value: string | string[] | boolean) => void;
	onSort: (sort: LibrarySort) => void;
	title: string;
	rowCount: number;
	actions?: React.ReactNode;
	empty: React.ReactNode;
	children: React.ReactNode;
}) => {
	useClampedPageIndex({
		rowCount,
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
	});
	const narrowed =
		search.query !== "" || activeFilterCount(filters, search) > 0;

	return (
		<>
			<BrowseResultsHeader title={title} count={rowCount}>
				{actions}
				<FiltersDrawer filters={filters} values={search} onChange={onFilter} />
				<SortControl value={search.sort} onChange={onSort} />
			</BrowseResultsHeader>
			{rowCount === 0 ? (
				narrowed ? (
					<NoResults />
				) : (
					empty
				)
			) : (
				<>
					<TileGrid>{children}</TileGrid>
					<CardPager
						rowCount={rowCount}
						pageIndex={search.pageIndex}
						pageSize={search.pageSize}
					/>
				</>
			)}
		</>
	);
};
