import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/account")({
	head: () => ({
		meta: [
			{
				title: "Account",
			},
		],
	}),
	pendingComponent: LoadingPage,
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
