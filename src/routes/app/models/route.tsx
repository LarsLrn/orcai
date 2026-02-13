import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/models")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Models",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
