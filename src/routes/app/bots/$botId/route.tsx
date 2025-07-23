import { createFileRoute, Outlet } from "@tanstack/react-router";
import { botQueryOptions } from "@/lib/query-options/bot";

export const Route = createFileRoute("/app/bots/$botId")({
	loader: async ({ context: { queryClient }, params: { botId } }) => {
		return await queryClient.ensureQueryData(
			botQueryOptions.find({
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
