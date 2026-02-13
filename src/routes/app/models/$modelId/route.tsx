import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/models/$modelId")({
	loader: async ({ context: { queryClient }, params: { modelId } }) => {
		return await queryClient.ensureQueryData(
			orpc.model.find.queryOptions({
				input: { id: modelId },
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
