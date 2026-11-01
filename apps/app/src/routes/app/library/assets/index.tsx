import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { RunFilter } from "@/components/activity/run-filter";
import { AssetTile } from "@/components/assets/asset-tile";
import { NoResults } from "@/components/browse/browse-layout";
import { LibraryEmpty } from "@/components/library/library-empty";
import { LibraryResults } from "@/components/library/library-results";
import { Button } from "@/components/ui/button";
import { useGenerateMissingMetadataMutation } from "@/hooks/mutations/use-asset-mutations";
import { useUtilityModel } from "@/hooks/use-utility-model";
import {
	assetLibrarySearchSchema,
	libraryCountsInput,
	libraryFilters,
	libraryListInput,
	librarySearchDefaults,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { m } from "@/paraglide/messages";

/** Generates metadata for the library assets that lack it; hidden without a utility model or anything to generate. */
const GenerateMissingMetadataAction = () => {
	const utilityModel = useUtilityModel();
	const { data } = useQuery(
		orpc.asset.missingMetadata.queryOptions({
			input: utilityModel.available ? {} : skipToken,
		}),
	);
	const count = data?.count ?? 0;
	const { mutate: generate, isPending } =
		useGenerateMissingMetadataMutation(count);

	if (!utilityModel.available || count === 0) {
		return null;
	}
	return (
		<Button
			variant="outline"
			size="sm"
			loading={isPending}
			onClick={() => generate({})}
		>
			<SparklesIcon />
			{m.assets_metadata_backfill_action()}
		</Button>
	);
};

export const Route = createFileRoute("/app/library/assets/")({
	validateSearch: assetLibrarySearchSchema,
	search: {
		middlewares: [
			retainSearchParams([
				"scope",
				"query",
			]),
			stripSearchParams(librarySearchDefaults(libraryFilters.asset)),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(
				orpc.asset.list.queryOptions({
					input: libraryListInput.asset(deps),
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
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: libraryListInput.asset(search),
			refetchInterval: (query) =>
				query.state.data?.data.some(isAssetWorking) ? METADATA_POLL_MS : false,
		}),
	);

	return (
		<>
			{search.run ? <RunFilter runId={search.run} /> : null}
			<LibraryResults
				view="asset"
				title={m.library_view_asset()}
				rowCount={assets.rowCount}
				actions={
					search.origin === "library" && !search.run ? (
						<GenerateMissingMetadataAction />
					) : null
				}
				empty={
					search.run ? (
						<NoResults />
					) : (
						<LibraryEmpty
							scope={search.scope}
							title={m.library_kind_empty_asset()}
						/>
					)
				}
			>
				{assets.data.map((asset) => (
					<AssetTile key={asset.id} asset={asset} />
				))}
			</LibraryResults>
		</>
	);
}
