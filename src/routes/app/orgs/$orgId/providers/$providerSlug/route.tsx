import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute(
	"/app/orgs/$orgId/providers/$providerSlug",
)({
	loader: async ({
		context: { queryClient },
		params: { orgId, providerSlug },
	}) => {
		return await queryClient.ensureQueryData(
			orpc.organizationProvider.find.queryOptions({
				input: { organizationId: orgId, providerSlug },
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.providerSlug,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
