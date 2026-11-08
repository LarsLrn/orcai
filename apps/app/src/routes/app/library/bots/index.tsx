import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { BotTile } from "@/components/bot/bot-tile";
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

export const Route = createFileRoute("/app/library/bots/")({
	validateSearch: librarySearchSchema(libraryFilters.bot),
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(librarySearchDefaults(libraryFilters.bot)),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(libraryListQuery.bot(deps)),
			queryClient.query(libraryCountsQuery(deps)),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { data: bots } = useSuspenseQuery(libraryListQuery.bot(search));

	return (
		<LibraryResults
			view="bot"
			title={m.library_view_bot()}
			rowCount={bots.rowCount}
			empty={
				<LibraryEmpty scope={search.scope} title={m.library_kind_empty_bot()} />
			}
		>
			{bots.data.map((bot) => (
				<BotTile key={bot.id} bot={bot} />
			))}
		</LibraryResults>
	);
}
