import { createFileRoute, Outlet } from "@tanstack/react-router";
import { courseQueryOptions } from "@/lib/query-options/course";

export const Route = createFileRoute("/app/courses/$courseId")({
	loader: async ({ context: { queryClient }, params: { courseId } }) => {
		return await queryClient.ensureQueryData(
			courseQueryOptions.find({
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
