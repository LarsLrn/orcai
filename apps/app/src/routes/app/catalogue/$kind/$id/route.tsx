import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { catalogueEntrySearchSchema } from "@/lib/catalogue/catalogue-filters";
import {
	catalogueEntryRef,
	loadCatalogueEntry,
} from "@/lib/router/catalogue-route";

export const Route = createFileRoute("/app/catalogue/$kind/$id")({
	validateSearch: catalogueEntrySearchSchema,
	beforeLoad: ({ params: { kind, id } }) => ({
		entryRef: catalogueEntryRef(kind, id),
	}),
	loader: ({ context: { queryClient, entryRef }, params: { kind } }) =>
		loadCatalogueEntry({
			queryClient,
			kind,
			entry: entryRef,
		}),
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.name,
			},
		],
	}),
	pendingComponent: LoadingPage,
});
