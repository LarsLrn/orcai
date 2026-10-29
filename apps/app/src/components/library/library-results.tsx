import { BrowseResults } from "@/components/browse/browse-results";
import { useLibrarySearch } from "@/components/library/library-browse";
import type { FilterValues } from "@/lib/browse/browse-search";
import {
	type LibraryView,
	libraryFilters,
} from "@/lib/library/library-filters";

/** One library view's results in the browse shell. */
export const LibraryResults = ({
	view,
	...props
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

	return (
		<BrowseResults
			filters={filters}
			search={search as typeof search & FilterValues<typeof filters>}
			onFilter={setFilter}
			onSort={setSort}
			{...props}
		/>
	);
};
