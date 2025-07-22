import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileViewer } from "@/components/documents/file-viewer";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/(assets)/assets/$assetId")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		await queryClient.ensureQueryData(
			orpc.asset.find.queryOptions({
				input: { id: assetId },
				queryKey: orpc.asset.find.key({ input: { id: assetId } }),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const { data: asset } = useSuspenseQuery(
		orpc.asset.find.queryOptions({
			input: { id: assetId },
			queryKey: orpc.asset.find.key({ input: { id: assetId } }),
		}),
	);

	return <FileViewer asset={asset.data} />;
}
