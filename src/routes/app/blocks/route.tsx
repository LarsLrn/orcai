import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/blocks")({
	head: () => ({
		meta: [
			{
				title: "Blocks",
			},
		],
	}),
	pendingComponent: LoadingPage,
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
