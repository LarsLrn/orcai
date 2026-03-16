import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	DownloadIcon,
	KeyRoundIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { FileViewer } from "@/components/documents/file-viewer";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Section,
	SectionAction,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { useDeleteAssetsMutation } from "@/hooks/mutations/use-asset-mutations";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/assets/$assetId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const [isAccessOpen, setIsAccessOpen] = useState(false);
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

	const { mutate: deleteAssets } = useDeleteAssetsMutation();

	return (
		<Section>
			<SectionHeader>
				<SectionTitle>{asset.data.title}</SectionTitle>
				<SectionAction>
					<Button variant="outline" onClick={() => setIsAccessOpen(true)}>
						<KeyRoundIcon />
						Access & Groups
					</Button>
					<Button
						variant="default"
						disabled={status !== "success"}
						onClick={() => window.open(file?.url, "_blank")}
					>
						<DownloadIcon />
						Download
					</Button>
					<Link
						className={buttonVariants({
							variant: "outline",
						})}
						to={"/app/hub/assets/$assetId/edit"}
						params={{
							assetId: asset.data.id,
						}}
					>
						<PencilIcon />
						Edit Content
					</Link>
					<Button
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
						Delete
					</Button>
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
