import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/chat")({
	component: RouteComponent,
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
