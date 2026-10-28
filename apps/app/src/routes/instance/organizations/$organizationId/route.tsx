import { organizationIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/instance/organizations/$organizationId")(
	{
		params: {
			parse: (params) => ({
				organizationId: parseParam(organizationIdSchema, params.organizationId),
			}),
		},
		loader: async ({ context: { queryClient }, params: { organizationId } }) =>
			await orNotFound(
				queryClient.query(
					orpc.instance.organization.queryOptions({
						input: {
							id: organizationId,
						},
					}),
				),
			),
		head: ({ loaderData }) => ({
			meta: [
				{
					title: loaderData?.data.name,
				},
			],
		}),
		component: RouteComponent,
		pendingComponent: LoadingPage,
	},
);

function RouteComponent() {
	return <Outlet />;
}
