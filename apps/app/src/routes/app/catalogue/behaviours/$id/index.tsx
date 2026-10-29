import { createFileRoute } from "@tanstack/react-router";
import { CatalogueEntryPage } from "@/components/catalogue/catalogue-entry-page";

export const Route = createFileRoute("/app/catalogue/behaviours/$id/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { from } = Route.useSearch();
	return <CatalogueEntryPage kind="behaviour" id={id} from={from} />;
}
