import {
	chatIdSchema,
	chatMessageIdSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod/v4";
import { ChatTitleMenu } from "@/components/chat/chat-actions-dropdown";
import { ChatPage, loadChatPage } from "@/components/chat/chat-page";
import { parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	...zedTokenSchema.shape,
	/** A search hit to open the chat on. */
	message: chatMessageIdSchema.optional(),
});

export const Route = createFileRoute("/app/assistant/$chatId/")({
	validateSearch: searchSchema,
	staticData: {
		titleMenu: ChatTitleMenu,
	},
	params: {
		parse: (params) => ({
			chatId: parseParam(chatIdSchema, params.chatId),
		}),
	},
	loaderDeps: ({ search: { zedToken, message } }) => ({
		zedToken,
		message,
	}),
	loader: ({
		params: { chatId },
		context: { queryClient, auth },
		deps: { zedToken, message },
	}) =>
		loadChatPage(
			{
				queryClient,
				chatId,
				zedToken,
				through: message,
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
	const { zedToken, message } = Route.useSearch();

	return (
		<ChatPage
			chatId={chatId}
			zedToken={zedToken}
			focusMessageId={message}
			loaded={Route.useLoaderData()}
			variant="assistant"
		/>
	);
}
