import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/chat")({
	head: () => ({
		meta: [
			{
				title: "Chats",
			},
		],
	}),
	pendingComponent: LoadingPage,
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
