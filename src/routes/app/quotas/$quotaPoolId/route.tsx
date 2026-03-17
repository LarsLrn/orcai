import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/quotas/$quotaPoolId")({
	loader: async ({ context: { queryClient }, params: { quotaPoolId } }) => {
		return await queryClient.ensureQueryData(
			orpc.quota.find.queryOptions({
				input: {
					id: quotaPoolId,
				},
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.name,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
