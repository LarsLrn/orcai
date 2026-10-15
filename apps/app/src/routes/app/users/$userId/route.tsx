import { userIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/users/$userId")({
	params: {
		parse: (params) => ({
			userId: parseParam(userIdSchema, params.userId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.user.find.queryOptions({
					input: {
						id: userId,
					},
					staleTime: "static",
				}),
			),
		);
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.data.name} (${loaderData?.data.email})`,
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
