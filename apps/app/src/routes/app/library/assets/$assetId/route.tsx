import { assetIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/library/assets/$assetId")({
	params: {
		parse: (params) => ({
			assetId: parseParam(assetIdSchema, params.assetId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.asset.find.queryOptions({
					input: {
						id: assetId,
					},
					staleTime: "static",
				}),
			),
		);
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.title,
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
