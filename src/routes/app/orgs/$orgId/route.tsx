import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/orgs/$orgId")({
	loader: async ({ context: { queryClient }, params: { orgId } }) => {
		return await queryClient.ensureQueryData(
			orpc.organization.find.queryOptions({
				input: { id: orgId },
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
});

function RouteComponent() {
	return <Outlet />;
}
