import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GlobeIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { AccessDialog } from "@/components/access/access-dialog";
import { FileViewer } from "@/components/documents/file-viewer";
import { JobStatusPanel } from "@/components/jobs/job-status-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageAction,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/ui/shell/page";
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
	const { data: visibility } = useSuspenseQuery(
		orpc.resource.getVisibility.queryOptions({
			input: {
				resourceType: "asset",
				resourceId: assetId,
			},
		}),
	);

	return (
		<Page>
			<PageHeader>
				<PageTitle>{asset.data.title}</PageTitle>
				<PageAction>
					<Button variant="outline" onClick={() => setIsAccessOpen(true)}>
						<KeyRoundIcon className="mr-2 h-4 w-4" />
						Access
					</Button>
				</PageAction>
			</PageHeader>
			<PageContent>
				<div className="mb-3 flex items-center gap-3">
					{visibility.data.visibility === "public" && (
						<Badge variant="default">
							<GlobeIcon className="mr-1 h-3 w-3" />
							Public
						</Badge>
					)}
					<JobStatusPanel
						processingStatus={asset.data.processingStatus}
						jobQueue="process-asset-job"
						resourceId={assetId}
						resourceType="asset"
						assetId={assetId}
					/>
				</div>
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
			</PageContent>
		</Page>
	);
}
