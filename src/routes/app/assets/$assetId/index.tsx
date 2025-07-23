import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileViewer } from "@/components/documents/file-viewer";
import { assetQueryOptions } from "@/lib/query-options/asset";

export const Route = createFileRoute("/app/assets/$assetId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const { data: asset } = useSuspenseQuery(
		assetQueryOptions.find({
			input: { id: assetId },
		}),
	);

	return <FileViewer asset={asset.data} />;
}
