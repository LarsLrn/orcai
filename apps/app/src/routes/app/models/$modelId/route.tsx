import { modelIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/models/$modelId")({
	params: {
		parse: (params) => ({
			modelId: modelIdSchema.parse(params.modelId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { modelId } }) => {
		return await queryClient.ensureQueryData(
			orpc.model.find.queryOptions({
				input: {
					id: modelId,
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
