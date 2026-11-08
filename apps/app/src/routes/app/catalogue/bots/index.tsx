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

export const Route = createFileRoute("/app/catalogue/bots/")({
	validateSearch: catalogueSearchSchemas.bot,
	search: {
		middlewares: [
			retainSearchParams([
				"query",
			]),
			stripSearchParams(catalogueSearchDefaults.bot),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		await Promise.all([
			queryClient.query(catalogueListQuery("bot", deps)),
			queryClient.query(catalogueCountsQuery(deps)),
		]);
	},
	head: () => ({
		meta: [
			{
				title: m.library_view_bot(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <CatalogueKindResults kind="bot" search={Route.useSearch()} />;
}
