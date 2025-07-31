import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";

export const Route = createFileRoute("/app/chat")({
	component: RouteComponent,
	pendingComponent: LoadingPage,
	head: () => ({
		meta: [
			{
				title: "Chats",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
