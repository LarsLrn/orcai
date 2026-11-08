import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod/v4";
import { loadActivityAttention } from "@/components/activity/activity-state";
import { recentChatsQuery } from "@/components/app/home/recent-chats";
import {
	catalogueTeaserQuery,
	tryBotsQuery,
} from "@/components/app/home/try-something";
import { UserHome } from "@/components/app/home/user-home";
import { loadChatStarter } from "@/components/chat/use-chat-starter";
import {
	failingRequired,
	readinessQuery,
} from "@/components/readiness/organization-readiness-card";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/_home/")({
	validateSearch: z.object({
		view: z.literal("use").optional().catch(undefined),
	}),
	// A turn fails until the required setup is done, so admins land on the
	// checklist by default. The Use tab asks for `?view=use` and is never redirected.
	beforeLoad: async ({
		context: { queryClient, isOrganizationAdmin },
		search,
	}) => {
		if (!isOrganizationAdmin || search.view === "use") {
			return;
		}
		const { data } = await queryClient.query(readinessQuery());
		if (failingRequired(data.checks) > 0) {
			throw redirect({
				to: "/app/manage",
				statusCode: 302,
			});
		}
	},
	loader: async ({ context: { queryClient, auth } }) => {
		await Promise.all([
			queryClient.query(
				orpc.organization.profile.queryOptions({
					input: {
						id: auth.session.activeOrganizationId,
					},
				}),
			),
			queryClient.query(tryBotsQuery()),
			queryClient.query(catalogueTeaserQuery()),
			queryClient.query(recentChatsQuery()),
			// These fail only their own cards.
			Promise.allSettled([
				loadChatStarter(queryClient),
				loadActivityAttention(queryClient),
			]),
		]);
	},
	component: UserHome,
});
