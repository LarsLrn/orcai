import { createFileRoute } from "@tanstack/react-router";
import { loadRepositoryReadiness } from "@/components/assets/readiness/use-repository-readiness";
import { BlockDetailPage } from "@/components/blocks/block-detail-page";
import { resourceVisibilityQuery } from "@/hooks/authz/use-resource-access";

export const Route = createFileRoute("/app/library/$kind/$blockId/")({
	// A repository's asset states fail only themselves.
	loader: async ({ context: { queryClient }, params: { kind, blockId } }) => {
		await Promise.all([
			queryClient.query(
				resourceVisibilityQuery({
					type: "block",
					id: blockId,
				}),
			),
			kind === "repository" &&
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
