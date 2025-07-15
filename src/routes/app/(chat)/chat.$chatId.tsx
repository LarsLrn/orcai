import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Attachment, UIMessage } from "ai";
import { Chat } from "@/components/chat/chat";
import type { ChatMessage } from "@/db/schema/chat-message";
import { orpc } from "@/lib/orpc/orpc";

// TODO: Will be deprecated with v5 of @ai-sdk anyway
function convertToUIMessages(messages: Array<ChatMessage>): Array<UIMessage> {
	return messages.map((message) => ({
		id: message.id,
		parts: message.parts as UIMessage["parts"],
		role: message.role as UIMessage["role"],
		// Note: content will soon be deprecated in @ai-sdk/react
		content: "",
		annotations: message.annotations as UIMessage["annotations"],
		createdAt: message.createdAt,
		experimental_attachments: (message.attachments as Array<Attachment>) ?? [],
	}));
}

export const Route = createFileRoute("/app/(chat)/chat/$chatId")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { chatId } }) => {
		await queryClient.ensureQueryData(
			orpc.chatMessage.list.queryOptions({
				input: { chatId, includeScores: true },
				queryKey: orpc.chatMessage.list.key({
					input: { chatId, includeScores: true },
				}),
			}),
		);
	},
});

function RouteComponent() {
	const { chatId } = Route.useParams();

	const messagesQuery = useSuspenseQuery(
		orpc.chatMessage.list.queryOptions({
			input: { chatId, includeScores: true },
			queryKey: orpc.chatMessage.list.key({
				input: { chatId, includeScores: true },
			}),
		}),
	);

	return (
		<div className="-my-6 -mx-2 sm:-mx-2 h-[calc(100dvh-56px)]">
			<Chat
				id={chatId}
				initialMessages={convertToUIMessages(messagesQuery.data.data)}
				scores={messagesQuery.data.scores.data}
			/>
		</div>
	);
}
