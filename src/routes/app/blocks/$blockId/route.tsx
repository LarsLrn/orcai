import { createFileRoute, Outlet } from "@tanstack/react-router";
import { blockQueryOptions } from "@/lib/query-options/block";

export const Route = createFileRoute("/app/blocks/$blockId")({
	loader: async ({ context: { queryClient }, params: { blockId } }) => {
		return await queryClient.ensureQueryData(
			blockQueryOptions.find({
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
