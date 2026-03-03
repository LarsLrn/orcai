import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/hub/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/app/hub/"!</div>;
}
