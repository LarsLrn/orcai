import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/library/bots")({
	head: () => ({
		meta: [
			{
				title: m.bots_page_title(),
			},
		],
	}),
	component: RouteComponent,
	pendingComponent: LoadingPage,
});

function RouteComponent() {
	return <Outlet />;
}
