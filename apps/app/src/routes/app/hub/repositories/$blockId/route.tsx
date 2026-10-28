import { blockIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/hub/repositories/$blockId")({
	params: {
		parse: (params) => ({
			blockId: parseParam(blockIdSchema, params.blockId),
		}),
	},
	staticData: {
		// The repository's own page is its block page.
		breadcrumbTo: (matches) => {
			const blockId = matches.find(
				(match) => match.routeId === "/app/hub/repositories/$blockId",
			)?.params.blockId;
			return blockId ? `/app/hub/blocks/${blockId}` : undefined;
		},
	},
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.block.find.queryOptions({
					input: {
						id: blockId,
					},
				}),
			),
		);
	},
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

function RouteComponent() {
	return <Outlet />;
}
