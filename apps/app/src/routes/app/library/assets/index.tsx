import { skipToken, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { RunFilter, runFilterQuery } from "@/components/activity/run-filter";
import { AssetTile } from "@/components/assets/asset-tile";
import { NoResults } from "@/components/browse/browse-layout";
import { LibraryEmpty } from "@/components/library/library-empty";
import { LibraryResults } from "@/components/library/library-results";
import { Button } from "@/components/ui/button";
import { useGenerateMissingMetadataMutation } from "@/hooks/mutations/use-asset-mutations";
import { activeOrganizationQuery } from "@/hooks/use-active-organization";
import { useUtilityModel } from "@/hooks/use-utility-model";
import { isAssetWorking, METADATA_POLL_MS } from "@/lib/labels/metadata-status";
import {
	assetLibrarySearchSchema,
	libraryFilters,
	librarySearchDefaults,
} from "@/lib/library/library-filters";
import {
	libraryCountsQuery,
	libraryListQuery,
} from "@/lib/library/library-queries";
import { orpc } from "@/lib/orpc/orpc";
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
	loader: async ({ context: { queryClient, auth }, deps }) => {
		const loadMissingMetadata = async () => {
			const { data: organization } = await queryClient.query(
				activeOrganizationQuery(auth.session.activeOrganizationId),
			);
			if (organization.utilityModelId) {
				await queryClient.query(
					orpc.asset.missingMetadata.queryOptions({
						input: {},
					}),
				);
			}
		};
		await Promise.all([
			queryClient.query(libraryListQuery.asset(deps)),
			queryClient.query(libraryCountsQuery(deps)),
			// The run's title and the metadata action fail only themselves.
			Promise.allSettled([
				deps.run && queryClient.query(runFilterQuery(deps.run)),
				deps.keptIn === "library" && !deps.run && loadMissingMetadata(),
			]),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const search = Route.useSearch();
	const { data: assets } = useSuspenseQuery({
		...libraryListQuery.asset(search),
		refetchInterval: (query) =>
			query.state.data?.data.some(isAssetWorking) ? METADATA_POLL_MS : false,
	});

	return (
		<>
			{search.run ? <RunFilter runId={search.run} /> : null}
			<LibraryResults
				view="asset"
				title={m.library_view_asset()}
				rowCount={assets.rowCount}
				actions={
					search.keptIn === "library" && !search.run ? (
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
