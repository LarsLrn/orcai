import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { orpc } from "@/lib/orpc/orpc";
import type { QdrantPoint } from "@/types/qdrant";

export const Route = createFileRoute("/app/assets/$assetId/points")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		const courseId = "placeholder"; // TODO: Replace with actual courseId when available

		await queryClient.ensureQueryData(
			orpc.assetPoints.list.queryOptions({
				input: { courseId, filters: { assetId } },
				queryKey: orpc.assetPoints.list.key({
					input: { filters: { assetId } },
				}),
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
	const courseId = "placeholder"; // TODO: Replace with actual courseId when available

	const { assetId } = Route.useParams();
	const { data: assetPoints } = useSuspenseQuery(
		orpc.assetPoints.list.queryOptions({
			input: { courseId, filters: { assetId } },
			queryKey: orpc.assetPoints.list.key({
				input: { filters: { assetId } },
			}),
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
