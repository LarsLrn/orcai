import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/providers/$providerId")({
	loader: async ({ context: { queryClient }, params: { providerId } }) => {
		return await queryClient.ensureQueryData(
			orpc.provider.find.queryOptions({
				input: {
					id: providerId,
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
