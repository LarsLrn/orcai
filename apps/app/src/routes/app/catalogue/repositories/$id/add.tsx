import { createFileRoute } from "@tanstack/react-router";
import { CatalogueInstallWizard } from "@/components/catalogue/catalogue-install-wizard";
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
	return <CatalogueInstallWizard kind="repository" id={id} from={from} />;
}
