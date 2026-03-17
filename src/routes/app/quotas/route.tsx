import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/quotas")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Quotas",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
