import { botIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/library/bots/$botId")({
	params: {
		parse: (params) => ({
			botId: parseParam(botIdSchema, params.botId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.bot.find.queryOptions({
					input: {
						id: botId,
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
