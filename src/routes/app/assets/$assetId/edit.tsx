import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AssetForm } from "@/components/forms/asset-form";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/assets/$assetId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Edit",
			},
		],
	}),
});

function RouteComponent() {
	const { assetId } = Route.useParams();
	const { data: asset } = useSuspenseQuery(
		orpc.asset.find.queryOptions({
			input: { id: assetId },
		}),
	);

	return <AssetForm asset={asset.data} />;
}
