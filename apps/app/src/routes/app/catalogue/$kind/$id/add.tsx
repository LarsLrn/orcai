import { createFileRoute } from "@tanstack/react-router";
import { CatalogueAddWizard } from "@/components/catalogue/catalogue-add-wizard";
import { loadAddedCatalogueEntry } from "@/lib/router/catalogue-route";

export const Route = createFileRoute("/app/catalogue/$kind/$id/add")({
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient, entryRef }, params: { kind }, deps }) =>
		loadAddedCatalogueEntry({
			queryClient,
			kind,
			entry: entryRef,
			search: deps,
		}),
	component: RouteComponent,
});

function RouteComponent() {
	const { entryRef } = Route.useRouteContext();
	const { from } = Route.useSearch();
	return <CatalogueAddWizard entryRef={entryRef} from={from} />;
}
