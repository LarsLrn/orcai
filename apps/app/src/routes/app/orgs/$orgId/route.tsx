import { organizationIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/orgs/$orgId")({
	params: {
		parse: (params) => ({
			orgId: parseParam(organizationIdSchema, params.orgId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { orgId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.organization.find.queryOptions({
					input: {
						id: orgId,
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
