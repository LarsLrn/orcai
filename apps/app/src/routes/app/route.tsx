import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Header } from "@/components/app/header";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { AppSidebar } from "@/components/app/sidebar/app-sidebar";
import { EmbeddingsSetupBanner } from "@/components/instance/settings/embeddings-setup-banner";
import { TourProvider } from "@/components/tour/tour-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { activeOrganizationQuery } from "@/hooks/use-active-organization";
import { useUmami } from "@/hooks/use-umami";
import { organizationCapabilitiesQuery } from "@/lib/authz/organization-capabilities-query";
import { ensureSignedIn } from "@/lib/authz/route-guards";

export const Route = createFileRoute("/app")({
	beforeLoad: ({ context }) => {
		const auth = ensureSignedIn(context.auth);
		const { activeOrganizationId } = auth.session;

		if (!activeOrganizationId) {
			throw redirect({
				to: "/select-organization",
				statusCode: 302,
			});
		}

		return {
			auth: {
				...auth,
				session: {
					...auth.session,
					activeOrganizationId,
				},
			},
		};
	},
	// The sidebar and pages read these with `useQuery`. Loaded here, the server
	// renders with them too, so a later-hydrating page cannot see them first.
	loader: async ({ context: { queryClient, auth } }) => {
		await Promise.allSettled([
			queryClient.query(
				activeOrganizationQuery(auth.session.activeOrganizationId),
			),
			queryClient.query(organizationCapabilitiesQuery()),
		]);
	},
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { identifyUser } = useUmami();

	identifyUser(auth.user);

	return (
		<SidebarProvider>
			<TourProvider>
				<AppSidebar />
				<SidebarInset className="max-w-full">
					<Header />
					<EmbeddingsSetupBanner />
					<div className="isolate mx-auto flex w-full flex-1 flex-col px-2 py-6 md:px-6">
						<Outlet />
					</div>
				</SidebarInset>
			</TourProvider>
		</SidebarProvider>
	);
}
