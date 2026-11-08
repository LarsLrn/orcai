import type { BlockType } from "@orcai/schema";
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
	blockLibrarySearchDefaults,
	blockLibrarySearchSchema,
} from "@/lib/library/library-filters";
import {
	libraryCountsQuery,
	libraryListQuery,
} from "@/lib/library/library-queries";
import { m } from "@/paraglide/messages";

const TEXT = {
	behaviour: {
		title: m.library_view_behaviour,
		empty: m.library_kind_empty_behaviour,
	},
	repository: {
		title: m.library_view_repository,
		empty: m.library_kind_empty_repository,
	},
} satisfies Record<
	BlockType,
	{
		title: () => string;
		empty: () => string;
	}
>;

export const Route = createFileRoute("/app/library/$kind/")({
	validateSearch: blockLibrarySearchSchema,
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(blockLibrarySearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { kind }, deps }) => {
		await Promise.all([
			queryClient.query(libraryListQuery[kind](deps)),
			queryClient.query(libraryCountsQuery(deps)),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { kind } = Route.useParams();
	const search = Route.useSearch();
	const { data: blocks } = useSuspenseQuery(libraryListQuery[kind](search));

	return (
		<LibraryResults
			view={kind}
			title={TEXT[kind].title()}
			rowCount={blocks.rowCount}
			empty={<LibraryEmpty scope={search.scope} title={TEXT[kind].empty()} />}
		>
			{blocks.data.map((block) => (
				<BlockTile key={block.id} block={block} />
			))}
		</LibraryResults>
	);
}
