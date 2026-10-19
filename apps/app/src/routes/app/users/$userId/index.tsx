import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/users/$userId/")({
	beforeLoad: ({ params: { userId } }) => {
		throw redirect({
			to: "/app/users/$userId/edit",
			params: {
				userId,
			},
			statusCode: 302,
		});
	},
	component: RouteComponent,
});

function RouteComponent() {
	return null;
}
