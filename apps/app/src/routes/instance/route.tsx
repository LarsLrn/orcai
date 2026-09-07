import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { InstanceShell } from "@/components/instance/instance-shell";
import { useUmami } from "@/hooks/use-umami";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";

export const Route = createFileRoute("/instance")({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/login",
				statusCode: 302,
			});
		}

		if (!isInstanceAdminRole(context.auth.user.role)) {
			throw redirect({
				to: "/app",
				statusCode: 302,
			});
		}

		return {
			auth: context.auth,
		};
	},
	head: () => ({
		meta: [
			{
				title: "Manage instance",
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	const { auth } = Route.useRouteContext();
	const { identifyUser } = useUmami();

	identifyUser(auth.user.id, {
		email: auth.user.email,
		name: auth.user.name,
	});

	return (
		<InstanceShell>
			<Outlet />
		</InstanceShell>
	);
}
