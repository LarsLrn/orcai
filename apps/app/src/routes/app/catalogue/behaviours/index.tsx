import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { CatalogueKindResults } from "@/components/catalogue/catalogue-kind-results";
import {
	catalogueSearchDefaults,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";
import {
	catalogueCountsQuery,
	catalogueListQuery,
} from "@/lib/catalogue/catalogue-queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/catalogue/behaviours/")({
	validateSearch: catalogueSearchSchemas.behaviour,
	search: {
		middlewares: [
			retainSearchParams([
				"query",
			]),
			stripSearchParams(catalogueSearchDefaults.behaviour),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(catalogueListQuery("behaviour", deps)),
			queryClient.query(catalogueCountsQuery(deps)),
		]);
	},
	head: () => ({
		meta: [
			{
				title: m.library_view_behaviour(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <CatalogueKindResults kind="behaviour" search={Route.useSearch()} />;
}
