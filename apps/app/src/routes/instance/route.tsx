import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { InstanceShell } from "@/components/instance/instance-shell";
import { useUmami } from "@/hooks/use-umami";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { ensureSignedIn } from "@/lib/authz/route-guards";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/instance")({
	beforeLoad: ({ context }) => {
		const auth = ensureSignedIn(context.auth);

		if (!isInstanceAdminRole(auth.user.role)) {
			throw redirect({
				to: "/app",
				statusCode: 302,
			});
		}

		return {
			auth,
		};
	},
	head: () => ({
		meta: [
			{
				title: m.instance_route_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { identifyUser } = useUmami();

	identifyUser(auth.user);

	return (
		<InstanceShell>
			<Outlet />
		</InstanceShell>
	);
}
