import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod/v4";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { catalogueEntrySearchSchema } from "@/lib/catalogue/catalogue-filters";
import { loadCatalogueEntry } from "@/lib/router/catalogue-entry-loader";
import { parseParam } from "@/lib/router/not-found";

export const Route = createFileRoute("/app/catalogue/behaviours/$id")({
	params: {
		parse: (params) => ({
			id: parseParam(z.uuidv4(), params.id),
		}),
	},
	validateSearch: catalogueEntrySearchSchema,
	loader: ({ context: { queryClient }, params: { id } }) =>
		loadCatalogueEntry({
			queryClient,
			kind: "behaviour",
			id,
		}),
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
