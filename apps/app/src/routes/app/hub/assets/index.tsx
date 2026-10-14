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
import { m } from "@/paraglide/messages";

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
				<SectionTitle>{m.assets_list_title()}</SectionTitle>
				<SectionDescription>{m.assets_list_description()}</SectionDescription>
				{canCreateAsset ? (
					<SectionAction>
						<Link
							to="/app/hub/assets/add"
							className={buttonVariants({
								size: "sm",
							})}
						>
							<PlusIcon />
							{m.assets_list_add_action()}
						</Link>
					</SectionAction>
				) : null}
			</SectionHeader>
			<SectionContent>
				{assets.data.length === 0 ? (
					<Placeholder
						Icon={FileTextIcon}
						tone="asset"
						title={m.assets_list_empty_state_title()}
						description={m.assets_list_empty_state_description()}
						actions={
							canCreateAsset
								? [
										{
											key: "add",
											label: m.assets_list_add_action(),
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
														label: m.assets_list_reprocess_action(),
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
