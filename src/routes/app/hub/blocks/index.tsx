import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/hub/blocks/")({
	beforeLoad: () => {
		throw redirect({
			to: "/app/hub/behaviour",
			statusCode: 302,
		});
	},
	component: RouteComponent,
});

function RouteComponent() {
	return null;
}
