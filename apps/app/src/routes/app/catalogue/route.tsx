import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import {
	CatalogueBrowse,
	useCatalogueView,
} from "@/components/catalogue/catalogue-browse";
import { catalogueCountsInput } from "@/lib/catalogue/catalogue-filters";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/catalogue")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.query(
			orpc.catalogue.counts.queryOptions({
				input: catalogueCountsInput({
					query: "",
				}),
				staleTime: "static",
			}),
		);
	},
	head: () => ({
		meta: [
			{
				title: m.catalogue_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

/** List views get the browsing shell; entry pages and wizards render on their own. */
function RouteComponent() {
	const view = useCatalogueView();
	return view ? (
		<CatalogueBrowse view={view}>
			<Outlet />
		</CatalogueBrowse>
	) : (
		<Outlet />
	);
}
