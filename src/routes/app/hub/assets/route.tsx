import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/hub/assets")({
	head: () => ({
		meta: [
			{
				title: "Content Library",
			},
		],
	}),
	pendingComponent: LoadingPage,
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
