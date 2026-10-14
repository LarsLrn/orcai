import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { ensureOrganizationCapability } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/users")({
	loader: async ({ context: { queryClient } }) => {
		await ensureOrganizationCapability({
			queryClient,
			permission: "manage_members",
			redirectTo: "/app",
		});
	},
	head: () => ({
		meta: [
			{
				title: m.users_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
