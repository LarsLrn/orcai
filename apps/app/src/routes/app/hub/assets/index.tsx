import { paginationInputSchema } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileTextIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { AssetCard } from "@/components/documents/asset-card";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useReprocessAssetMutation } from "@/hooks/mutations/use-job-mutations";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/assets/")({
	validateSearch: paginationInputSchema,
	loaderDeps: ({ search: { pageIndex, pageSize } }) => ({
		pageIndex,
		pageSize,
	}),
	loader: async ({
		context: { queryClient },
		deps: { pageIndex, pageSize },
	}) => {
		await queryClient.query(
			orpc.asset.list.queryOptions({
				input: {
					pageIndex,
					pageSize,
				},
				staleTime: "static",
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
	const { data: organizationCapabilities } = useOrganizationCapabilities([
		"create_asset",
	]);
	const canCreateAsset = hasCapability(
		organizationCapabilities?.data.capabilities,
		"create_asset",
	);
	const { data: assets } = useSuspenseQuery(
		orpc.asset.list.queryOptions({
			input: {
				pageIndex,
				pageSize,
			},
		}),
	);

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>Assets</SectionTitle>
				<SectionDescription>
					Reusable source material for retrieval, grounding, and citations.
				</SectionDescription>
				{canCreateAsset ? (
					<SectionAction>
						<Link
							to="/app/hub/assets/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							Add assets
						</Link>
					</SectionAction>
				) : null}
			</SectionHeader>
			<SectionContent>
				{assets.data.length === 0 ? (
					<Placeholder
						Icon={FileTextIcon}
						tone="asset"
						title="No assets yet"
						description="Upload files, URLs, or text snippets so bots can retrieve and cite them."
						actions={
							canCreateAsset
								? [
										{
											key: "add",
											label: "Add assets",
											icon: PlusIcon,
											variant: "default",
											linkProps: {
												to: "/app/hub/assets/add",
											},
										},
									]
								: []
						}
					/>
				) : (
					<SectionGrid layout="3">
						{assets.data.map((asset) => (
							<AssetCard
								key={asset.id}
								asset={asset}
								actions={{
									dropdown:
										asset.processingStatus === "pending" ||
										asset.processingStatus === "active" ||
										!hasCapability(asset.capabilities, "edit")
											? []
											: [
													{
														key: "reprocess",
														label: "Reprocess",
														icon: RefreshCwIcon,
														onClick: () =>
															reprocessAsset({
																assetId: asset.id,
															}),
													},
												],
									footer: [],
								}}
							/>
						))}
					</SectionGrid>
				)}
			</SectionContent>
		</Section>
	);
}
