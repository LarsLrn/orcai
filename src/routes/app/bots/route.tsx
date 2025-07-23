import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bots")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Bots",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
