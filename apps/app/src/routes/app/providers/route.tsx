import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/providers")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_providers",
			redirectTo: "/app",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.providers_route_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
