import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import {
	CatalogueBrowse,
	useCatalogueView,
} from "@/components/catalogue/catalogue-browse";
import { catalogueCountsQuery } from "@/lib/catalogue/catalogue-queries";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/catalogue")({
	loader: async ({ context: { queryClient } }) => {
		await queryClient.query(
			catalogueCountsQuery({
				query: "",
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
