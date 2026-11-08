import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { BlockTile } from "@/components/blocks/block-tile";
import { LibraryEmpty } from "@/components/library/library-empty";
import { LibraryResults } from "@/components/library/library-results";
import {
	libraryFilters,
	librarySearchDefaults,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import {
	libraryCountsQuery,
	libraryListQuery,
} from "@/lib/library/library-queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/repositories/")({
	validateSearch: librarySearchSchema(libraryFilters.repository),
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(librarySearchDefaults(libraryFilters.repository)),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(libraryListQuery.repository(deps)),
			queryClient.query(libraryCountsQuery(deps)),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { data: blocks } = useSuspenseQuery(
		libraryListQuery.repository(search),
	);

	return (
		<LibraryResults
			view="repository"
			title={m.library_view_repository()}
			rowCount={blocks.rowCount}
			empty={
				<LibraryEmpty
					scope={search.scope}
					title={m.library_kind_empty_repository()}
				/>
			}
		>
			{blocks.data.map((block) => (
				<BlockTile key={block.id} block={block} />
			))}
		</LibraryResults>
	);
}
