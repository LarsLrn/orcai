import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/orgs/$orgId/providers")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Providers",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
