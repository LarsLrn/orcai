import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import {
	LibraryBrowse,
	useLibraryView,
} from "@/components/library/library-browse";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library")({
	loader: async ({ context: { queryClient, auth } }) => {
		const id = auth.session?.activeOrganizationId;
		if (id)
			await queryClient.query(
				orpc.organization.find.queryOptions({
					input: {
						id,
					},
					staleTime: "static",
				}),
			);
	},
	head: () => ({
		meta: [
			{
				title: m.library_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

/** List views get the browsing shell; details and forms render on their own. */
function RouteComponent() {
	const view = useLibraryView();
	return view ? (
		<LibraryBrowse view={view}>
			<Outlet />
		</LibraryBrowse>
	) : (
		<Outlet />
	);
}
