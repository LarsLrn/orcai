import { providerIdSchema } from "@orcai/schema";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/providers/$providerId")({
	params: {
		parse: (params) => ({
			providerId: parseParam(providerIdSchema, params.providerId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { providerId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.provider.find.queryOptions({
					input: {
						id: providerId,
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
