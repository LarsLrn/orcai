import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/groups")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Groups",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
