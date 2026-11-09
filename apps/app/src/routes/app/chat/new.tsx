import { botIdSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { loadChatStarter } from "@/components/chat/composer/use-chat-starter";
import { NewChat } from "@/components/chat/new-chat";
import { loadWebSearchNotice } from "@/components/chat/web-search-notice";
import { loadChatRepositoryReadiness } from "@/components/preparation/use-repository-readiness";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	botId: botIdSchema.optional(),
});

export const Route = createFileRoute("/app/chat/new")({
	validateSearch: searchSchema,
	loaderDeps: ({ search: { botId } }) => ({
		botId,
	}),
	loader: async ({ context: { queryClient, auth }, deps: { botId } }) => {
		await Promise.allSettled([
			loadChatStarter(queryClient, botId).then((model) =>
				loadWebSearchNotice(queryClient, {
					organizationId: auth.session.activeOrganizationId,
					botId,
					providerId: model?.providerId,
				}),
			),
			loadChatRepositoryReadiness(queryClient, {
				botId,
			}),
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: m.chat_new_page_title(),
			},
		],
	}),
});

function RouteComponent() {
	const { botId } = Route.useSearch();

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<NewChat botId={botId} />
		</div>
	);
}
