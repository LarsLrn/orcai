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
import { useReprocessAssetMutation } from "@/hooks/mutations/use-job-mutations";
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
		await queryClient.ensureQueryData(
			orpc.asset.list.queryOptions({
				input: {
					pageIndex,
					pageSize,
				},
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { pageIndex, pageSize } = Route.useSearch();
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
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
				<SectionTitle>Content Library</SectionTitle>
				<SectionDescription>
					Reusable source material for retrieval, grounding, and citations.
				</SectionDescription>
				<SectionAction>
					<Link
						to="/app/hub/assets/add"
						className={buttonVariants({
							size: "sm",
						})}
					>
						<PlusIcon />
						Add Content
					</Link>
				</SectionAction>
			</SectionHeader>
			<SectionContent>
				{assets.data.length === 0 ? (
					<Placeholder
						Icon={FileTextIcon}
						title="No content yet"
						description="Upload documents, URLs, or text snippets to build your knowledge base."
						actions={[
							{
								key: "add",
								label: "Add Content",
								icon: PlusIcon,
								variant: "default",
								linkProps: {
									to: "/app/hub/assets/add",
								},
							},
						]}
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
										asset.processingStatus === "active"
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
