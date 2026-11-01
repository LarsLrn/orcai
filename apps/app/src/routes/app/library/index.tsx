import type { LibraryEntry, LibraryScope } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { BotTile } from "@/components/bot/bot-tile";
import {
	NoResults,
	Shelf,
	ShelfItem,
	TileGrid,
} from "@/components/browse/browse-layout";
import { LIBRARY_VIEWS } from "@/components/library/library-browse";
import { LibraryEmpty } from "@/components/library/library-empty";
import {
	LibraryEntryTile,
	libraryEntryId,
} from "@/components/library/library-entry-tile";
import { LibraryResults } from "@/components/library/library-results";
import {
	type LibrarySearch,
	libraryCountsInput,
	libraryFilters,
	libraryListInput,
	librarySearchDefaults,
	librarySearchSchema,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { m } from "@/paraglide/messages";

/** Below this many items, the overview is one grid instead of shelves. */
const SHELVES_FROM = 6;

const overviewInput = (scope: LibraryScope) => ({
	scope,
});

export const Route = createFileRoute("/app/library/")({
	validateSearch: librarySearchSchema(libraryFilters.overview),
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(librarySearchDefaults(libraryFilters.overview)),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			deps.query
				? queryClient.query(
						orpc.library.search.queryOptions({
							input: libraryListInput.overview(deps),
							staleTime: "static",
						}),
					)
				: queryClient.query(
						orpc.library.overview.queryOptions({
							input: overviewInput(deps.scope),
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
	return search.query ? (
		<SearchResults search={search} />
	) : (
		<Overview scope={search.scope} />
	);
}

/** Every kind at once, in one order and one pager. */
const SearchResults = ({ search }: { search: LibrarySearch<"overview"> }) => {
	const { data: results } = useSuspenseQuery(
		orpc.library.search.queryOptions({
			input: libraryListInput.overview(search),
		}),
	);
	return (
		<LibraryResults
			view="overview"
			title={m.library_search_results_title()}
			rowCount={results.rowCount}
			empty={<NoResults />}
		>
			{results.data.map((entry) => (
				<LibraryEntryTile key={libraryEntryId(entry)} entry={entry} />
			))}
		</LibraryResults>
	);
};

const Overview = ({ scope }: { scope: LibraryScope }) => {
	const {
		data: { data: overview },
	} = useSuspenseQuery(
		orpc.library.overview.queryOptions({
			input: overviewInput(scope),
			refetchInterval: (query) =>
				query.state.data?.data.asset.data.some(isAssetWorking)
					? METADATA_POLL_MS
					: false,
		}),
	);
	const kinds = LIBRARY_VIEWS.filter((view) => view.view !== "overview");
	const entries = kinds.flatMap((view): LibraryEntry[] =>
		view.view === "bot"
			? overview.bot.data.map((bot) => ({
					kind: "bot",
					bot,
				}))
			: view.view === "asset"
				? overview.asset.data.map((asset) => ({
						kind: "asset",
						asset,
					}))
				: overview[view.view].data.map((block) => ({
						kind: "block",
						block,
					})),
	);
	const total = kinds.reduce(
		(sum, view) => sum + overview[view.view].rowCount,
		0,
	);

	if (total === 0) return <LibraryEmpty scope={scope} />;

	if (total < SHELVES_FROM) {
		const createdAt = (entry: LibraryEntry) =>
			(entry.kind === "bot"
				? entry.bot.createdAt
				: entry.kind === "block"
					? entry.block.createdAt
					: entry.asset.createdAt
			)?.getTime() ?? 0;
		return (
			<div className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					{m.library_overview_sparse({
						count: total,
					})}
				</p>
				<TileGrid>
					{[
						...entries,
					]
						.sort((a, b) => createdAt(b) - createdAt(a))
						.map((entry) => (
							<LibraryEntryTile key={libraryEntryId(entry)} entry={entry} />
						))}
				</TileGrid>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			{overview.drafts.length > 0 ? (
				<Shelf title={m.library_shelf_drafts()} restorationId="library-drafts">
					{overview.drafts.map((entry) => (
						<ShelfItem key={libraryEntryId(entry)}>
							<LibraryEntryTile entry={entry} />
						</ShelfItem>
					))}
				</Shelf>
			) : null}
			{overview.favourites.length > 0 ? (
				<Shelf
					title={m.library_shelf_favourites()}
					restorationId="library-favourites"
				>
					{overview.favourites.map((bot) => (
						<ShelfItem key={bot.id}>
							<BotTile bot={bot} />
						</ShelfItem>
					))}
				</Shelf>
			) : null}
			{kinds.map((view) =>
				overview[view.view].rowCount > 0 ? (
					<Shelf
						key={view.view}
						title={view.label()}
						seeAll={{
							to: view.to,
						}}
						restorationId={`library-${view.view}`}
					>
						{entries
							.filter((entry) =>
								view.view === "bot"
									? entry.kind === "bot"
									: view.view === "asset"
										? entry.kind === "asset"
										: entry.kind === "block" &&
											(entry.block.type === "behaviour") ===
												(view.view === "behaviour"),
							)
							.map((entry) => (
								<ShelfItem key={libraryEntryId(entry)}>
									<LibraryEntryTile entry={entry} />
								</ShelfItem>
							))}
					</Shelf>
				) : null,
			)}
		</div>
	);
};
