import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/groups/$groupId")({
	loader: async ({ context: { queryClient }, params: { groupId } }) => {
		return await queryClient.ensureQueryData(
			orpc.group.find.queryOptions({
				input: {
					id: groupId,
				},
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
