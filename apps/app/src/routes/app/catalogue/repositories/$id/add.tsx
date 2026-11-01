import { createFileRoute } from "@tanstack/react-router";
import { CatalogueAddWizard } from "@/components/catalogue/catalogue-add-wizard";
import { loadAddedCatalogueEntry } from "@/lib/router/catalogue-entry-loader";

export const Route = createFileRoute("/app/catalogue/repositories/$id/add")({
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, params: { id }, deps }) =>
		loadAddedCatalogueEntry({
			queryClient,
			kind: "repository",
			id,
			search: deps,
		}),
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { from } = Route.useSearch();
	return <CatalogueAddWizard kind="repository" id={id} from={from} />;
}
