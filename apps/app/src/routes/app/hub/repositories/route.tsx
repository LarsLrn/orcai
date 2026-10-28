import { createFileRoute, Outlet } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/hub/repositories")({
	head: () => ({
		meta: [
			{
				title: m.blocks_repositories_page_title(),
			},
		],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
