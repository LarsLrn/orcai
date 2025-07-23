import { createFileRoute, Outlet } from "@tanstack/react-router";
import { userQueryOptions } from "@/lib/query-options/user";

export const Route = createFileRoute("/app/users/$userId")({
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		return await queryClient.ensureQueryData(
			userQueryOptions.find({
				input: { id: userId },
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.data.name} (${loaderData?.data.email})`,
			},
		],
	}),
});

function RouteComponent() {
	return <Outlet />;
}
