import { blockIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { EmbeddingsRebuildNotice } from "@/components/preparation/embeddings-rebuild-notice";
import { loadBlockOfType } from "@/lib/router/block-route";
import { parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/library/$kind/$blockId")({
	params: {
		parse: (params) => ({
			blockId: parseParam(blockIdSchema, params.blockId),
		}),
	},
	loader: ({ context: { queryClient }, params: { kind, blockId } }) =>
		loadBlockOfType({
			queryClient,
			blockId,
			type: kind,
		}),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.name,
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

/** A repository's pages say when its passages wait for new embeddings. */
function RouteComponent() {
	const { kind } = Route.useParams();
	return (
		<>
			{kind === "repository" ? (
				<EmbeddingsRebuildNotice className="mb-4" />
			) : null}
			<Outlet />
		</>
	);
}
