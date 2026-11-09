import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { activitySummaryOptions } from "@/components/activity/activity-state";
import { Header } from "@/components/app/header";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { AppSidebar } from "@/components/app/sidebar/app-sidebar";
import { loadAssistantModel } from "@/components/assistant/use-assistant-model";
import { EmbeddingsSetupBanner } from "@/components/preparation/embeddings-setup-banner";
import {
	TourProvider,
	tourPreferencesQuery,
} from "@/components/tour/tour-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { activeOrganizationQuery } from "@/hooks/use-active-organization";
import { embeddingsStatusQuery } from "@/hooks/use-embeddings-configured";
import { useUmami } from "@/hooks/use-umami";
import { organizationCapabilitiesQuery } from "@/lib/router/organization-capabilities-query";
import { ensureSignedIn } from "@/lib/router/route-guards";

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
	// The shell and pages read these with `useQuery`. Loaded here, the server
	// renders with them too, so a later-hydrating page cannot see them first.
	// A failed read fails only its readers, as on the client.
	loader: async ({ context: { queryClient, auth } }) => {
		const { activeOrganizationId } = auth.session;
		await Promise.allSettled([
			queryClient.query(activeOrganizationQuery(activeOrganizationId)),
			queryClient.query(organizationCapabilitiesQuery()),
			queryClient.query(embeddingsStatusQuery()),
			queryClient.query(activitySummaryOptions()),
			queryClient.query(tourPreferencesQuery()),
			loadAssistantModel(queryClient, activeOrganizationId),
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
