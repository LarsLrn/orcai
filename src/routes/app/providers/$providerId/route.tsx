import { createFileRoute, Outlet } from "@tanstack/react-router";
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
