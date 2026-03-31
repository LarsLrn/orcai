import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/blocks/$blockId")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		return await queryClient.ensureQueryData(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
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
