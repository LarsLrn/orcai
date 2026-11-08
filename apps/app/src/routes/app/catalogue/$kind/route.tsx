import { createFileRoute } from "@tanstack/react-router";
import { catalogueKindTitle } from "@/components/catalogue/catalogue-kind-results";
import { catalogueKindParams } from "@/lib/router/catalogue-route";

export const Route = createFileRoute("/app/catalogue/$kind")({
	params: catalogueKindParams,
	// Runs on a slug that did not parse too, with the raw slug in params.
	head: ({ params, match }) => ({
		meta: match.paramsError
			? []
			: [
					{
						title: catalogueKindTitle(params.kind),
					},
				],
	}),
});
