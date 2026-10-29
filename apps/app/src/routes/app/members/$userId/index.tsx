import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/members/$userId/")({
	beforeLoad: ({ params: { userId } }) => {
		throw redirect({
			to: "/app/members/$userId/edit",
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
