import {
	createFileRoute,
	retainSearchParams,
	stripSearchParams,
} from "@tanstack/react-router";
import { CatalogueKindResults } from "@/components/catalogue/catalogue-kind-results";
import {
	catalogueKindSearchDefaults,
	catalogueKindSearchSchema,
} from "@/lib/catalogue/catalogue-filters";
import {
	catalogueCountsQuery,
	catalogueListQuery,
} from "@/lib/catalogue/catalogue-queries";

export const Route = createFileRoute("/app/catalogue/$kind/")({
	validateSearch: catalogueKindSearchSchema,
	search: {
		middlewares: [
			retainSearchParams([
				"query",
			]),
			stripSearchParams(catalogueKindSearchDefaults),
		],
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, params: { kind }, deps }) => {
		await Promise.all([
			queryClient.query(catalogueListQuery(kind, deps)),
			queryClient.query(catalogueCountsQuery(deps)),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { kind } = Route.useParams();
	return <CatalogueKindResults kind={kind} search={Route.useSearch()} />;
}
