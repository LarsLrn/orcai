import { createFileRoute, Outlet } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/hub/courses/$courseId")({
	loader: async ({ context: { queryClient }, params: { courseId } }) => {
		return await queryClient.ensureQueryData(
			orpc.course.find.queryOptions({
				input: { id: courseId },
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.title,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
