import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Home,
	beforeLoad: ({ context }) => {
		if (context.auth.isAuthenticated) {
			throw redirect({ to: "/app" });
		}
		throw redirect({ to: "/login", statusCode: 302 });
	},
});

function Home() {
	return null;
}
