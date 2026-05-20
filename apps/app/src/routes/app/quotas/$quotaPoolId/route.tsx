import { quotaPoolIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/quotas/$quotaPoolId")({
	params: {
		parse: (params) => ({
			quotaPoolId: quotaPoolIdSchema.parse(params.quotaPoolId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { quotaPoolId } }) => {
		return await queryClient.ensureQueryData(
			orpc.quota.find.queryOptions({
				input: {
					id: quotaPoolId,
				},
			}),
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
