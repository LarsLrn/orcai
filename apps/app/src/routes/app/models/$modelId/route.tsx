import { modelIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/models/$modelId")({
	params: {
		parse: (params) => ({
			modelId: parseParam(modelIdSchema, params.modelId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { modelId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.model.find.queryOptions({
					input: {
						id: modelId,
					},
					staleTime: "static",
				}),
			),
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
