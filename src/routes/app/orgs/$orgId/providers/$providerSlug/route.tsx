import { createFileRoute, Outlet } from "@tanstack/react-router";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";

export const Route = createFileRoute(
	"/app/orgs/$orgId/providers/$providerSlug",
)({
	loader: async ({
		context: { queryClient },
		params: { orgId, providerSlug },
	}) => {
		return await queryClient.ensureQueryData(
			organizationProviderQueryOptions.find({
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
