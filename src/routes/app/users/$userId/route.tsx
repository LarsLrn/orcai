import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/users/$userId")({
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		return await queryClient.ensureQueryData(
			orpc.user.find.queryOptions({
				input: { id: userId },
				queryKey: orpc.user.find.key({ input: { id: userId } }),
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.data.name} (${loaderData?.data.email})`,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
