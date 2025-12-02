import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/bots/$botId")({
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		return await queryClient.ensureQueryData(
			orpc.bot.find.queryOptions({
				input: { id: botId },
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.name,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
