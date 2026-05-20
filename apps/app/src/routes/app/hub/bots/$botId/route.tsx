import { botIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/bots/$botId")({
	params: {
		parse: (params) => ({
			botId: botIdSchema.parse(params.botId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		return await queryClient.ensureQueryData(
			orpc.bot.find.queryOptions({
				input: {
					id: botId,
				},
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
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
