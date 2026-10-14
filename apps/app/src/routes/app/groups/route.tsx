import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/groups")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_groups",
			redirectTo: "/app",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.groups_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
