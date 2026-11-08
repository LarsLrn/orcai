import { userIdSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/app/members/$userId")({
	params: {
		parse: (params) => ({
			userId: parseParam(userIdSchema, params.userId),
		}),
	},
	loader: async ({ context: { queryClient }, params: { userId } }) => {
		return await orNotFound(
			queryClient.query(
				orpc.organizationMember.find.queryOptions({
					input: {
						userId,
					},
				}),
			),
		);
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? m.members_detail_page_meta_title({
							name: loaderData.data.name,
							email: loaderData.data.email,
						})
					: m.members_page_title(),
			},
		],
	}),
	pendingComponent: LoadingPage,
});
