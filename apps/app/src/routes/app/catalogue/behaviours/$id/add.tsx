import { createFileRoute } from "@tanstack/react-router";
import { CatalogueInstallWizard } from "@/components/catalogue/catalogue-install-wizard";
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
	return <CatalogueInstallWizard kind="behaviour" id={id} from={from} />;
}
