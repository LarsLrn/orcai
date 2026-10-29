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
	libraryCountsInput,
	libraryFilters,
	libraryListInput,
	librarySearchDefaults,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/behaviours/")({
	validateSearch: librarySearchSchema(libraryFilters.behaviour),
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(librarySearchDefaults(libraryFilters.behaviour)),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(
				orpc.block.list.queryOptions({
					input: libraryListInput.behaviour(deps),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.library.counts.queryOptions({
					input: libraryCountsInput(deps),
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { data: blocks } = useSuspenseQuery(
		orpc.block.list.queryOptions({
			input: libraryListInput.behaviour(search),
		}),
	);

	return (
		<LibraryResults
			view="behaviour"
			title={m.library_view_behaviour()}
			rowCount={blocks.rowCount}
			empty={
				<LibraryEmpty
					scope={search.scope}
					title={m.library_kind_empty_behaviour()}
				/>
			}
		>
			{blocks.data.map((block) => (
				<BlockTile key={block.id} block={block} />
			))}
		</LibraryResults>
	);
}
