import { userIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/instance/users/$userId")({
	params: {
		parse: (params) => ({
			userId: parseParam(userIdSchema, params.userId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { userId } }) =>
		await orNotFound(
			queryClient.query(
				orpc.instance.user.queryOptions({
					input: {
						id: userId,
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
});

function RouteComponent() {
	return <Outlet />;
}
