import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { orpc } from "@/lib/orpc/orpc";
import type { QdrantPoint } from "@/types/qdrant";

export const Route = createFileRoute("/app/blocks/$blockId/points")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await queryClient.ensureQueryData(
			orpc.assetPoint.list.queryOptions({
				input: { filters: { blockId, limit: 1000 } },
			}),
		);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Points",
			},
		],
	}),
});

function RouteComponent() {
	const { blockId } = Route.useParams();
	const { data: assetPoints } = useSuspenseQuery(
		orpc.assetPoint.list.queryOptions({
			input: { filters: { blockId, limit: 1000 } },
		}),
	);

	return (
		<div className="grid grid-cols-1 gap-2">
			{assetPoints.data.map((point) => (
				<DisplayPoint key={point.id} point={point as QdrantPoint} />
			))}
		</div>
	);
}
