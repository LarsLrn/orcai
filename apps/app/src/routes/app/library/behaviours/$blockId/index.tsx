import { createFileRoute } from "@tanstack/react-router";
import { BlockDetailPage } from "@/components/blocks/block-detail-page";
import { resourceVisibilityQuery } from "@/hooks/authz/use-resource-access";

export const Route = createFileRoute("/app/library/behaviours/$blockId/")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await queryClient.query(
			resourceVisibilityQuery({
				type: "block",
				id: blockId,
			}),
		);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();

	return <BlockDetailPage blockId={blockId} />;
}
