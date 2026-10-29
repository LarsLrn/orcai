import { FiltersDrawer, SortControl } from "@/components/browse/browse-filters";
import {
	BrowseResultsHeader,
	NoResults,
	TileGrid,
} from "@/components/browse/browse-layout";
import { useLibrarySearch } from "@/components/library/library-browse";
import { CardPager, useClampedPageIndex } from "@/components/ui/card-pager";
import {
	activeFilterCount,
	type FilterValues,
} from "@/lib/browse/browse-search";
import {
	type LibraryView,
	libraryFilters,
} from "@/lib/library/library-filters";

/**
 * One view's results: heading with the count, Filters (n) below `lg` and the
 * sort, then the tiles and the pager. With nothing to show, `empty` when
 * nothing is narrowed, and a "nothing matches" otherwise.
 */
export const LibraryResults = ({
	view,
	title,
	rowCount,
	actions,
	empty,
	children,
}: {
	view: LibraryView;
	title: string;
	rowCount: number;
	actions?: React.ReactNode;
	empty: React.ReactNode;
	children: React.ReactNode;
}) => {
	const { search, setFilter, setSort } = useLibrarySearch(view);
	const filters = libraryFilters[view];
	const values = search as FilterValues<typeof filters>;
	useClampedPageIndex({
		rowCount,
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
	});
	const narrowed =
		search.query !== "" || activeFilterCount(filters, values) > 0;

	return (
		<>
			<BrowseResultsHeader title={title} count={rowCount}>
				{actions}
				<FiltersDrawer filters={filters} values={values} onChange={setFilter} />
				<SortControl value={search.sort} onChange={setSort} />
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
