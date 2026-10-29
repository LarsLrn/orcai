import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	DownloadIcon,
	EditIcon,
	KeyRoundIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { FileViewer } from "@/components/documents/file-viewer";
import { MetadataStatusNotice } from "@/components/documents/shared/metadata-generation";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import {
	useDeleteAssetsMutation,
	useReprocessAssetMutation,
} from "@/hooks/mutations/use-asset-mutations";
import { openFreshUrl } from "@/lib/assets/open-fresh-url";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/assets/$assetId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const navigate = useNavigate();
	const [isAccessOpen, setIsAccessOpen] = useState(false);
	const { mutate: reprocessAsset } = useReprocessAssetMutation();
	const { data: asset } = useSuspenseQuery(
		orpc.asset.find.queryOptions({
			input: {
				id: assetId,
			},
			refetchInterval: (query) =>
				query.state.data && isAssetWorking(query.state.data.data)
					? METADATA_POLL_MS
					: false,
		}),
	);

	const { status, refetch } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: asset.data.id,
				attachment: true,
			},
		}),
	);

	const { mutate: deleteAssets } = useDeleteAssetsMutation(
		{
			onSuccess: async () => {
				await navigate({
					to: "/app/hub/assets",
				});
			},
		},
		{
			names: [
				asset.data.title,
			],
		},
	);
	const canDownload = hasCapability(asset.data.capabilities, "download");
	const canEdit = hasCapability(asset.data.capabilities, "edit");
	const canDelete = hasCapability(asset.data.capabilities, "delete");
	const canManageAccess = hasCapability(
		asset.data.capabilities,
		"manage_access",
	);

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>{asset.data.title}</SectionTitle>
				<HeaderActions
					actions={[
						canDownload && {
							key: "download",
							label: m.assets_detail_download_button(),
							icon: DownloadIcon,
							variant: "default",
							disabled: status !== "success",
							onClick: () => openFreshUrl(refetch),
						},
						canEdit && {
							key: "edit",
							label: m.assets_detail_edit_action(),
							icon: EditIcon,
							linkProps: {
								to: "/app/hub/assets/$assetId/edit",
								params: {
									assetId: asset.data.id,
								},
							},
						},
						canManageAccess && {
							key: "access",
							label: m.assets_detail_access_action(),
							icon: KeyRoundIcon,
							onClick: () => setIsAccessOpen(true),
						},
						canEdit &&
							asset.data.processingStatus !== "pending" &&
							asset.data.processingStatus !== "active" && {
								key: "reprocess",
								label: m.assets_detail_reprocess_action(),
								icon: RefreshCwIcon,
								overflow: true,
								onClick: () =>
									reprocessAsset({
										id: asset.data.id,
									}),
							},
						canDelete && {
							key: "delete",
							label: m.assets_detail_delete_action(),
							icon: Trash2Icon,
							destructive: true,
							onClick: () =>
								deleteAssets({
									refs: [
										{
											id: asset.data.id,
										},
									],
								}),
						},
					]}
				/>
			</SectionHeader>
			<SectionContent className="space-y-4">
				<MetadataStatusNotice asset={asset.data} canEdit={canEdit} />
				<FileViewer asset={asset.data} />

				{canManageAccess ? (
					<AccessDialog
						open={isAccessOpen}
						onOpenChange={setIsAccessOpen}
						resourceRef={{
							type: "asset",
							id: asset.data.id,
						}}
						resourceName={asset.data.title}
					/>
				) : null}
			</SectionContent>
		</Section>
	);
}
