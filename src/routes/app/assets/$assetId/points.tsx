import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoint } from "@/components/documents/chunks/display-point";
import { assetPointQueryOptions } from "@/lib/query-options/asset-point";
import type { QdrantPoint } from "@/types/qdrant";

export const Route = createFileRoute("/app/assets/$assetId/points")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		await queryClient.ensureQueryData(
			assetPointQueryOptions.list({
				input: { filters: { assetId } },
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
	const { assetId } = Route.useParams();
	const { data: assetPoints } = useSuspenseQuery(
		assetPointQueryOptions.list({
			input: { filters: { assetId } },
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
