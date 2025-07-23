import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/courses")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Courses",
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
