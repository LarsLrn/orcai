import { quotaPoolIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/quota-pools/$quotaPoolId")({
	params: {
		parse: (params) => ({
			quotaPoolId: parseParam(quotaPoolIdSchema, params.quotaPoolId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { quotaPoolId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.quotaPool.find.queryOptions({
					input: {
						id: quotaPoolId,
					},
					staleTime: "static",
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
