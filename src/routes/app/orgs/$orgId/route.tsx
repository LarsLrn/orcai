import { createFileRoute, Outlet } from "@tanstack/react-router";
import { organizationQueryOptions } from "@/lib/query-options/organization";

export const Route = createFileRoute("/app/orgs/$orgId")({
	loader: async ({ context: { queryClient }, params: { orgId } }) => {
		return await queryClient.ensureQueryData(
			organizationQueryOptions.find({
				input: { id: orgId },
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
