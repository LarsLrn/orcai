import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/blocks")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Blocks",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
