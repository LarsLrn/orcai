import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/users/$userId")({
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		return await queryClient.ensureQueryData(
			orpc.user.find.queryOptions({
				input: {
					id: userId,
				},
			}),
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
