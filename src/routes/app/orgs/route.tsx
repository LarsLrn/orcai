import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/orgs")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Organisations",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
