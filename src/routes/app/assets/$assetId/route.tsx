import { createFileRoute, Outlet } from "@tanstack/react-router";
import { assetQueryOptions } from "@/lib/query-options/asset";

export const Route = createFileRoute("/app/assets/$assetId")({
	loader: async ({ context: { queryClient }, params: { assetId } }) => {
		return await queryClient.ensureQueryData(
			assetQueryOptions.find({
				input: { id: assetId },
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
