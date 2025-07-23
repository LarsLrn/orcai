import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/users")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Users",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
