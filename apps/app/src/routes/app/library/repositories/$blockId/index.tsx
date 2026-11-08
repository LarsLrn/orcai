import { createFileRoute } from "@tanstack/react-router";
import { loadRepositoryReadiness } from "@/components/assets/readiness/use-repository-readiness";
import { BlockDetailPage } from "@/components/blocks/block-detail-page";
import { resourceVisibilityQuery } from "@/hooks/authz/use-resource-access";

export const Route = createFileRoute("/app/library/repositories/$blockId/")({
	// The asset states fail only themselves.
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		await Promise.all([
			queryClient.query(
				resourceVisibilityQuery({
					type: "block",
					id: blockId,
				}),
			),
			Promise.allSettled([
				loadRepositoryReadiness(queryClient, [
					blockId,
				]),
			]),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { blockId } = Route.useParams();

	return <BlockDetailPage blockId={blockId} />;
}
