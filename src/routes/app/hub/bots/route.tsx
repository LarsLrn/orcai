import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/hub/bots")({
	component: RouteComponent,
	pendingComponent: LoadingPage,
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
