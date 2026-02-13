import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/providers")({
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
