import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/instance/")({
	beforeLoad: () => {
		throw redirect({
			to: "/instance/organizations",
			statusCode: 302,
		});
	},
});
