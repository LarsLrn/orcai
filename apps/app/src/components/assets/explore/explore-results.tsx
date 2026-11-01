import type { AssetId, BlockId } from "@orcai/core";
import type { AssetPointBrowseCursor, RetrievalMode } from "@orcai/schema";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DisplayPoint } from "@/components/assets/passages/display-point";
import { Placeholder } from "@/components/placeholders/placeholder";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const TOP_K_OPTIONS = [
	10,
	25,
	50,
] as const;
export type TopK = (typeof TOP_K_OPTIONS)[number];

const Pending = () => (
	<div className="flex min-h-48 items-center justify-center">
		<Spinner className="size-8" />
	</div>
);

/** The repository's passages page by page; one asset's in reading order. */
export const ExploreBrowse = ({
	repositoryId,
	assetId,
}: {
	repositoryId: BlockId;
	assetId?: AssetId;
}) => {
	// The key holds the repository and asset, so changing either starts over.
	const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfiniteQuery(
			orpc.assetPoint.browseRepository.infiniteOptions({
				input: (cursor: AssetPointBrowseCursor | undefined) => ({
					repositoryId,
					assetId,
					cursor,
				}),
				initialPageParam: undefined,
				getNextPageParam: (page) => page.nextCursor ?? undefined,
			}),
		);

	if (status === "pending") return <Pending />;

	if (status === "error") {
		return (
			<Placeholder
				title={m.blocks_explore_browse_error_title()}
				description={m.blocks_explore_browse_error_description()}
			/>
		);
	}

	const points = data.pages.flatMap((page) => page.data);

	if (points.length === 0) {
		return (
			<Placeholder
				title={m.blocks_explore_browse_empty_title()}
				description={m.blocks_explore_browse_empty_description()}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{points.map((point) => (
				<DisplayPoint key={point.id} point={point} />
			))}
			{hasNextPage ? (
				<Button
					variant="outline"
					className="self-center"
					loading={isFetchingNextPage}
					onClick={() => void fetchNextPage()}
				>
					{m.blocks_explore_load_more()}
				</Button>
			) : null}
		</div>
	);
};

/** The top `topK` passages for the query, ranked, without the per-asset cap a bot's search applies. */
export const ExploreSearch = ({
	repositoryId,
	query,
	mode,
	assetId,
	topK,
}: {
	repositoryId: BlockId;
	query: string;
	mode: RetrievalMode;
	assetId?: AssetId;
	topK: TopK;
}) => {
	const { data, status } = useQuery(
		orpc.assetPoint.searchRepository.queryOptions({
			input: {
				repositoryId,
				filters: {
					queries: [
						query,
					],
					retrievalMode: mode,
					limit: topK,
					maxPerAsset: topK,
					assetIds: assetId
						? [
								assetId,
							]
						: undefined,
				},
			},
		}),
	);

	if (status === "pending") return <Pending />;

	if (status === "error") {
		return (
			<Placeholder
				title={m.blocks_explore_search_error_title()}
				description={m.blocks_explore_search_error_description()}
			/>
		);
	}

	if (data.data.length === 0) {
		return (
			<Placeholder
				title={m.blocks_explore_search_empty_title()}
				description={m.blocks_explore_search_empty_description()}
			/>
		);
	}

	return (
		<ol
			aria-label={m.blocks_explore_search_results_label()}
			className="flex flex-col gap-4"
		>
			{data.data.map((point) => (
				<li key={point.id}>
					<DisplayPoint point={point} showScore />
				</li>
			))}
		</ol>
	);
};
