import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DownloadIcon, MessageSquareIcon } from "lucide-react";
import { useAssetActions } from "@/components/documents/asset-actions";
import { FileViewer } from "@/components/documents/file-viewer";
import { MetadataStatusNotice } from "@/components/documents/shared/metadata-generation";
import { Badge } from "@/components/ui/badge";
import { HeaderActions } from "@/components/ui/shell/actions";
import {
	DetailHeader,
	DetailHeaderBand,
	DetailHeaderDescription,
	DetailHeaderHeading,
	DetailHeaderIcon,
	DetailHeaderMeta,
	DetailHeaderTitle,
} from "@/components/ui/shell/detail-header";
import { Page, PageContent } from "@/components/ui/shell/page";
import { ResourceOwner } from "@/components/users/resource-owner";
import { openFreshUrl } from "@/lib/assets/open-fresh-url";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { getFileTypeLabel } from "@/lib/presentation/file-type";
import {
	isAssetWorking,
	METADATA_POLL_MS,
} from "@/lib/presentation/metadata-status";
import { RESOURCE_KINDS } from "@/lib/presentation/resource-kind";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/assets/$assetId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const navigate = useNavigate();
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

	const { actions, dialog } = useAssetActions(asset.data, {
		listing: true,
		onDeleted: async () => {
			await navigate({
				to: "/app/library/assets",
			});
		},
	});
	const { Icon, well, band, badge, label } = RESOURCE_KINDS.asset;

	return (
		<Page>
			<DetailHeader>
				<DetailHeaderBand className={band}>
					<Icon />
				</DetailHeaderBand>
				<DetailHeaderIcon className={well}>
					<Icon />
				</DetailHeaderIcon>
				<DetailHeaderHeading>
					<DetailHeaderTitle>{asset.data.title}</DetailHeaderTitle>
					<DetailHeaderMeta>
						<Badge variant={badge}>{label()}</Badge>
						<span>{getFileTypeLabel(asset.data.fileType)}</span>
						{asset.data.origin === "chat" ? (
							<Badge variant="outline">
								<MessageSquareIcon aria-hidden="true" />
								{m.assets_origin_chat_badge()}
							</Badge>
						) : null}
						<ResourceOwner owner={asset.data.owner} />
					</DetailHeaderMeta>
					<HeaderActions
						actions={[
							hasCapability(asset.data.capabilities, "download") && {
								key: "download",
								label: m.assets_detail_download_button(),
								icon: DownloadIcon,
								variant: "default",
								disabled: status !== "success",
								onClick: () => openFreshUrl(refetch),
							},
							actions.edit,
							actions.access,
							actions.handOver,
							actions.addToLibrary,
							actions.reprocess,
							actions.listing,
							actions.delete,
						]}
					/>
				</DetailHeaderHeading>
				{asset.data.metadata.description ? (
					<DetailHeaderDescription>
						{asset.data.metadata.description}
					</DetailHeaderDescription>
				) : null}
			</DetailHeader>
			<PageContent className="space-y-4">
				<MetadataStatusNotice
					asset={asset.data}
					canEdit={hasCapability(asset.data.capabilities, "edit")}
				/>
				<FileViewer asset={asset.data} />
			</PageContent>
			{dialog}
		</Page>
	);
}
