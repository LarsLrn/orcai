import type { CatalogueKind } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	NoResults,
	Shelf,
	ShelfItem,
	TileGrid,
} from "@/components/browse/browse-layout";
import {
	CATALOGUE_VIEWS,
	CatalogueResults,
} from "@/components/catalogue/catalogue-browse";
import { CatalogueEmpty } from "@/components/catalogue/catalogue-empty";
import { CatalogueTile } from "@/components/catalogue/catalogue-tile";
import {
	type CatalogueSearch,
	catalogueCountsInput,
	catalogueListInput,
	catalogueSearchDefaults,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Below this many entries, Discover is one grid instead of shelves. */
const SHELVES_FROM = 6;

const SHELF_SIZE = 12;

const KINDS = [
	"bot",
	"behaviour",
	"repository",
] as const satisfies CatalogueKind[];

/** A shelf's entries: the newest of a kind, or of every kind. */
const shelfInput = (kind?: CatalogueKind) =>
	({
		...catalogueListInput("overview", catalogueSearchDefaults.overview),
		pageSize: SHELF_SIZE,
		kind,
	}) as const;

export const Route = createFileRoute("/app/catalogue/")({
	validateSearch: catalogueSearchSchemas.overview,
	search: {
		middlewares: [
			retainSearchParams([
				"query",
			]),
			stripSearchParams(catalogueSearchDefaults.overview),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			...(deps.query
				? [
						queryClient.query(
							orpc.catalogue.list.queryOptions({
								input: catalogueListInput("overview", deps),
								staleTime: "static",
							}),
						),
					]
				: [
						undefined,
						...KINDS,
					].map((kind) =>
						queryClient.query(
							orpc.catalogue.list.queryOptions({
								input: shelfInput(kind),
								staleTime: "static",
							}),
						),
					)),
			queryClient.query(
				orpc.catalogue.counts.queryOptions({
					input: catalogueCountsInput(deps),
					staleTime: "static",
				}),
			),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	return search.query ? <SearchResults search={search} /> : <Discover />;
}

/** Every kind at once, in one order and one pager. */
const SearchResults = ({ search }: { search: CatalogueSearch<"overview"> }) => {
	const { data: results } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: catalogueListInput("overview", search),
		}),
	);
	return (
		<CatalogueResults
			view="overview"
			title={m.catalogue_search_results_title()}
			rowCount={results.rowCount}
			empty={<NoResults />}
		>
			{results.data.map((entry) => (
				<CatalogueTile key={entry.id} entry={entry} />
			))}
		</CatalogueResults>
	);
};

/** The newest entries, then a shelf per kind; a plain grid while there are few. */
const Discover = () => {
	const { data: newest } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: shelfInput(),
		}),
	);
	const { data: bots } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: shelfInput("bot"),
		}),
	);
	const { data: behaviours } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: shelfInput("behaviour"),
		}),
	);
	const { data: repositories } = useSuspenseQuery(
		orpc.catalogue.list.queryOptions({
			input: shelfInput("repository"),
		}),
	);
	const shelves = {
		bot: bots,
		behaviour: behaviours,
		repository: repositories,
	};

	if (newest.rowCount === 0) return <CatalogueEmpty />;

	if (newest.rowCount < SHELVES_FROM) {
		return (
			<div className="flex flex-col gap-4">
				<p className="text-muted-foreground text-sm">
					{m.catalogue_overview_sparse({
						count: newest.rowCount,
					})}
				</p>
				<TileGrid>
					{newest.data.map((entry) => (
						<CatalogueTile key={entry.id} entry={entry} />
					))}
				</TileGrid>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			<Shelf title={m.catalogue_shelf_new()} restorationId="catalogue-new">
				{newest.data.map((entry) => (
					<ShelfItem key={entry.id}>
						<CatalogueTile entry={entry} />
					</ShelfItem>
				))}
			</Shelf>
			{CATALOGUE_VIEWS.flatMap((view) =>
				view.view === "overview" || shelves[view.view].rowCount === 0
					? []
					: [
							<Shelf
								key={view.view}
								title={view.label()}
								seeAll={{
									to: view.to,
								}}
								restorationId={`catalogue-${view.view}`}
							>
								{shelves[view.view].data.map((entry) => (
									<ShelfItem key={entry.id}>
										<CatalogueTile entry={entry} />
									</ShelfItem>
								))}
							</Shelf>,
						],
			)}
		</div>
	);
};
