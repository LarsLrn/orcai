import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { CatalogueKindResults } from "@/components/catalogue/catalogue-kind-results";
import {
	catalogueCountsInput,
	catalogueListInput,
	catalogueSearchDefaults,
	catalogueSearchSchemas,
} from "@/lib/catalogue/catalogue-filters";
import { orpc } from "@/lib/orpc/orpc";
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
			queryClient.query(
				orpc.catalogue.list.queryOptions({
					input: catalogueListInput("bot", deps),
					staleTime: "static",
				}),
			),
			queryClient.query(
				orpc.catalogue.counts.queryOptions({
					input: catalogueCountsInput(deps),
					staleTime: "static",
				}),
			),
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
