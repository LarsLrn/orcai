import { createFileRoute } from "@tanstack/react-router";
import { CatalogueAddWizard } from "@/components/catalogue/catalogue-add-wizard";
import { loadAddedCatalogueEntry } from "@/lib/router/catalogue-entry-loader";

export const Route = createFileRoute("/app/catalogue/behaviours/$id/add")({
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, params: { id }, deps }) =>
		loadAddedCatalogueEntry({
			queryClient,
			kind: "behaviour",
			id,
			search: deps,
		}),
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { from } = Route.useSearch();
	return <CatalogueAddWizard kind="behaviour" id={id} from={from} />;
}
