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
	libraryCountsInput,
	libraryFilters,
	libraryListInput,
	librarySearchDefaults,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";
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
			queryClient.query(
				orpc.bot.list.queryOptions({
					input: libraryListInput.bot(deps),
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
	const { data: bots } = useSuspenseQuery(
		orpc.bot.list.queryOptions({
			input: libraryListInput.bot(search),
		}),
	);

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
