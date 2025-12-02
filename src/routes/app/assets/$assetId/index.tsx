import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileViewer } from "@/components/documents/file-viewer";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/assets/$assetId/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const { data: asset } = useSuspenseQuery(
		orpc.asset.find.queryOptions({
			input: { id: assetId },
		}),
	);

	return <FileViewer asset={asset.data} />;
}
