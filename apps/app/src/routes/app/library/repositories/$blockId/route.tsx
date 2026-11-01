import { blockIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { loadBlockOfType } from "@/lib/router/block-loader";
import { parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/library/repositories/$blockId")({
	params: {
		parse: (params) => ({
			blockId: parseParam(blockIdSchema, params.blockId),
		}),
	},
	loader: ({ context: { queryClient }, params: { blockId } }) =>
		loadBlockOfType({
			queryClient,
			blockId,
			type: "repository",
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

function RouteComponent() {
	return <Outlet />;
}
