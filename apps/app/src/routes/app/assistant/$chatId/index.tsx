import { chatIdSchema, zedTokenSchema } from "@orcai/schema";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod/v4";
import { ChatPage, loadChatPage } from "@/components/chat/chat-page";
import { parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	...zedTokenSchema.shape,
});

export const Route = createFileRoute("/app/assistant/$chatId/")({
	validateSearch: searchSchema,
	params: {
		parse: (params) => ({
			chatId: parseParam(chatIdSchema, params.chatId),
		}),
	},
	loaderDeps: ({ search: { zedToken } }) => ({
		zedToken,
	}),
	loader: ({
		params: { chatId },
		context: { queryClient, auth },
		deps: { zedToken },
	}) =>
		loadChatPage(
			{
				queryClient,
				chatId,
				zedToken,
			},
			(chat) => {
				// Readable from any organisation over the API, but only shown in its own.
				if (
					chat.kind !== "assistant" ||
					chat.organizationId !== auth.session.activeOrganizationId
				) {
					throw notFound();
				}
			},
		),
	component: RouteComponent,
	head: ({ loaderData }) => {
		const chat = loaderData?.chat?.data;

		return {
			meta: [
				{
					title: chat
						? (chat.title ?? m.chat_title_placeholder())
						: m.assistant_name(),
				},
			],
		};
	},
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const { zedToken } = Route.useSearch();

	return (
		<ChatPage
			chatId={chatId}
			zedToken={zedToken}
			loaded={Route.useLoaderData()}
			variant="assistant"
		/>
	);
}
