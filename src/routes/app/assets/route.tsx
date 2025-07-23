import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/assets")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Assets",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
