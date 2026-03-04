import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/assets/$assetId")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		return await queryClient.ensureQueryData(
			orpc.asset.find.queryOptions({
				input: {
					id: assetId,
				},
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.title,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
