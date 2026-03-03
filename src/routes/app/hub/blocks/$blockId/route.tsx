import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/blocks/$blockId")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		return await queryClient.ensureQueryData(
			orpc.block.find.queryOptions({
				input: { id: blockId },
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
