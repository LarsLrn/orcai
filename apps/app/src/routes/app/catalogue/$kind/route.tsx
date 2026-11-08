import { catalogueKindSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { catalogueKindTitle } from "@/components/catalogue/catalogue-kind-results";
import { kindParams } from "@/lib/router/kind-params";

export const Route = createFileRoute("/app/catalogue/$kind")({
	params: kindParams(catalogueKindSchema.options),
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
