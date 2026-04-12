import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	DownloadIcon,
	EditIcon,
	KeyRoundIcon,
	MoreVerticalIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { FileViewer } from "@/components/documents/file-viewer";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useDeleteAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import { useReprocessAssetMutation } from "@/hooks/mutations/use-job-mutations";
import { orpc } from "@/lib/orpc/orpc";

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
		}),
	);

	const { data: file, status } = useQuery(
		orpc.storage.createDownloadUrl.queryOptions({
			input: {
				id: asset.data.id,
				prefix: asset.data.prefix,
				bucket: asset.data.bucket,
				fileType: asset.data.fileType,
			},
		}),
	);

	const { mutate: deleteAssets } = useDeleteAssetsMutation({
		onMutate: async () => {
			await navigate({
				to: "/app/hub/assets",
			});
		},
	});

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>{asset.data.title}</SectionTitle>
				<SectionAction>
					<Button
						variant="default"
						disabled={status !== "success"}
						onClick={() => window.open(file?.url, "_blank")}
					>
						<DownloadIcon />
						Download
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon">
									<MoreVerticalIcon className="size-4" />
									<span className="sr-only">More options</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => setIsAccessOpen(true)}>
								<KeyRoundIcon className="size-4" />
								Access & Groups
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									navigate({
										to: "/app/hub/assets/$assetId/edit",
										params: {
											assetId: asset.data.id,
										},
									})
								}
							>
								<EditIcon />
								Edit Content
							</DropdownMenuItem>
							{asset.data.processingStatus !== "pending" &&
								asset.data.processingStatus !== "active" && (
									<DropdownMenuItem
										onClick={() =>
											reprocessAsset({
												assetId: asset.data.id,
											})
										}
									>
										<RefreshCwIcon className="size-4" />
										Reprocess
									</DropdownMenuItem>
								)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={() =>
									deleteAssets({
										refs: [
											{
												id: asset.data.id,
											},
										],
									})
								}
							>
								<Trash2Icon />
								Delete Content
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SectionAction>
			</SectionHeader>
			<SectionContent>
				<FileViewer asset={asset.data} />

				<AccessDialog
					open={isAccessOpen}
					onOpenChange={setIsAccessOpen}
					resourceRef={{
						type: "asset",
						id: asset.data.id,
					}}
					resourceName={asset.data.title}
				/>
			</SectionContent>
		</Section>
	);
}
