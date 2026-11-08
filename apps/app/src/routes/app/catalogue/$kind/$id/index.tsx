import { createFileRoute } from "@tanstack/react-router";
import { CatalogueEntryPage } from "@/components/catalogue/catalogue-entry-page";

export const Route = createFileRoute("/app/catalogue/$kind/$id/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { entryRef } = Route.useRouteContext();
	const { from } = Route.useSearch();
	return <CatalogueEntryPage entryRef={entryRef} from={from} />;
}
