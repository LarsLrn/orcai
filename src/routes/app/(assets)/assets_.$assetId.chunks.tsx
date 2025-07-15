import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayChunk } from "@/components/documents/chunks/display-chunk";
import { orpc } from "@/lib/orpc/orpc";
import type { QdrantChunk } from "@/types/qdrant";

export const Route = createFileRoute("/app/(assets)/assets_/$assetId/chunks")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		await queryClient.ensureQueryData(
			orpc.assetPoints.list.queryOptions({
				input: { filters: { documentId: assetId } },
				queryKey: orpc.assetPoints.list.key({
					input: { filters: { documentId: assetId } },
				}),
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const { data: assetPoints } = useSuspenseQuery(
		orpc.assetPoints.list.queryOptions({
			input: { filters: { documentId: assetId } },
			queryKey: orpc.assetPoints.list.key({
				input: { filters: { documentId: assetId } },
			}),
		}),
	);

	return (
		<div className="grid grid-cols-1 gap-2">
			{assetPoints.data.map((point) => (
				<DisplayChunk key={point.id} chunk={point as QdrantChunk} />
			))}
		</div>
	);
}
