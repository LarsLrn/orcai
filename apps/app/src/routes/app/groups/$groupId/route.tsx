import { groupIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/groups/$groupId")({
	params: {
		parse: (params) => ({
			groupId: parseParam(groupIdSchema, params.groupId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { groupId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.group.find.queryOptions({
					input: {
						id: groupId,
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
