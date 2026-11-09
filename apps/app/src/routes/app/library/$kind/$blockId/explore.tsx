import type { AssetId } from "@orcai/core";
import {
	assetIdSchema,
	retrievalModeSchema,
	SEARCH_QUERY_MAX_LENGTH,
	searchQuerySchema,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	notFound,
	stripSearchParams,
} from "@tanstack/react-router";
import { z } from "zod/v4";
import {
	ExploreBrowse,
	ExploreSearch,
	exploreBrowseOptions,
	exploreSearchQuery,
	TOP_K_OPTIONS,
	type TopK,
} from "@/components/assets/explore/explore-results";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { DataTableSearch } from "@/components/ui/data-table/data-table-search";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
import { orpc } from "@/lib/orpc/orpc";
import { loadBlockOfType } from "@/lib/router/block-route";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	/** A search query; without one the page browses. */
	query: searchQuerySchema.trim().catch("").default(""),
	mode: retrievalModeSchema.optional().catch(undefined),
	/** One asset of the repository. */
	asset: assetIdSchema.optional().catch(undefined),
	k: z.coerce
		.number()
		.pipe(z.union(TOP_K_OPTIONS.map((count) => z.literal(count))))
		.optional()
		.catch(undefined),
});

const ALL_ASSETS = "all";

/** The search with its defaults. */
const exploreSearch = ({
	query,
	mode = "hybrid",
	asset,
	k = 10,
}: z.infer<typeof searchSchema>) => ({
	q: query || undefined,
	mode,
	asset,
	k,
});

/** The asset the search names, when the repository holds it. */
const selectedAssetId = (
	assets:
		| readonly {
				id: AssetId;
		  }[]
		| undefined,
	asset: AssetId | undefined,
) => assets?.find((entry) => entry.id === asset)?.id;

export const Route = createFileRoute("/app/library/$kind/$blockId/explore")({
	validateSearch: searchSchema,
	search: {
		middlewares: [
			stripSearchParams({
				query: "",
			}),
		],
	},
	loaderDeps: ({ search }) => exploreSearch(search),
	beforeLoad: ({ params: { kind } }) => {
		if (kind !== "repository") throw notFound();
	},
	loader: async ({
		context: { queryClient },
		params: { blockId },
		deps: { q, mode, asset, k },
	}) => {
		const repository = await loadBlockOfType({
			queryClient,
			blockId,
			type: "repository",
		});
		if (repository.data.status !== "ready") {
			throw notFound();
		}
		const assetId = selectedAssetId(repository.assets, asset);
		// The results fail only themselves.
		await Promise.allSettled([
			q
				? queryClient.query(
						exploreSearchQuery({
							repositoryId: blockId,
							query: q,
							mode,
							assetId,
							topK: k,
						}),
					)
				: queryClient.infiniteQuery(
						exploreBrowseOptions({
							repositoryId: blockId,
							assetId,
						}),
					),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.blocks_explore_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { q, mode, asset, k } = exploreSearch(Route.useSearch());
	const navigate = Route.useNavigate();
	const { data: repository } = useSuspenseQuery(
		orpc.block.find.queryOptions({
			input: {
				id: blockId,
			},
		}),
	);

	const assetOptions = [
		{
			value: ALL_ASSETS,
			label: m.blocks_explore_asset_all(),
		},
		...(repository.assets ?? []).map((entry) => ({
			value: entry.id as string,
			label: entry.title,
		})),
	];
	const assetId = selectedAssetId(repository.assets, asset);

	const hint = q
		? m.blocks_explore_search_hint()
		: assetId
			? m.blocks_explore_browse_asset_hint()
			: m.blocks_explore_browse_all_hint();

	return (
		<Page>
			<PageHeader>
				<PageTitle>
					{m.blocks_explore_heading({
						name: repository.data.name,
					})}
				</PageTitle>
				<PageDescription>{m.blocks_explore_description()}</PageDescription>
			</PageHeader>
			<PageContent className="space-y-6">
				<div className="space-y-3">
					<DataTableSearch
						label={m.blocks_explore_search_label()}
						placeholder={m.blocks_explore_search_placeholder()}
						maxLength={SEARCH_QUERY_MAX_LENGTH}
						className="w-full"
					/>
					<div className="flex flex-wrap items-center gap-2">
						<OptionPicker
							options={assetOptions}
							value={assetId ?? ALL_ASSETS}
							onChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										asset:
											value === ALL_ASSETS
												? undefined
												: assetIdSchema.parse(value),
									}),
								})
							}
							aria-label={m.blocks_explore_asset_label()}
							className="w-64 max-w-full"
						/>
						{q ? (
							<>
								<OptionPicker
									options={[
										{
											value: "hybrid",
											label: m.blocks_retrieval_mode_hybrid_label(),
										},
										{
											value: "dense",
											label: m.blocks_retrieval_mode_dense_label(),
										},
										{
											value: "sparse",
											label: m.blocks_retrieval_mode_sparse_label(),
										},
									]}
									value={mode}
									onChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												mode: value,
											}),
										})
									}
									aria-label={m.blocks_explore_mode_label()}
								/>
								<OptionPicker
									options={TOP_K_OPTIONS.map((count) => ({
										value: String(count),
										label: m.blocks_explore_top_k_option({
											count,
										}),
									}))}
									value={String(k)}
									onChange={(value) =>
										navigate({
											search: (previous) => ({
												...previous,
												k: Number(value) as TopK,
											}),
										})
									}
									aria-label={m.blocks_explore_top_k_label()}
								/>
							</>
						) : null}
					</div>
					<p className="text-muted-foreground text-sm">{hint}</p>
				</div>
				{q ? (
					<ExploreSearch
						repositoryId={blockId}
						query={q}
						mode={mode}
						assetId={assetId}
						topK={k}
					/>
				) : (
					<ExploreBrowse repositoryId={blockId} assetId={assetId} />
				)}
			</PageContent>
		</Page>
	);
}
