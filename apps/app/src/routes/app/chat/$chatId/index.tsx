import {
	chatIdSchema,
	chatMessageIdSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod/v4";
import { ChatPage, loadChatPage } from "@/components/chat/chat-page";
import { parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	...zedTokenSchema.shape,
	/** A search hit to open the chat on. */
	message: chatMessageIdSchema.optional(),
});

export const Route = createFileRoute("/app/chat/$chatId/")({
	validateSearch: searchSchema,
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
		context: { queryClient },
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
				if (chat.kind === "assistant") {
					throw redirect({
						to: "/app/assistant/$chatId",
						params: {
							chatId,
						},
						search: {
							zedToken,
							message,
						},
					});
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
						: m.chat_detail_page_title_fallback(),
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
		/>
	);
}
