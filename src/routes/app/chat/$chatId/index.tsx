import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { Chat } from "@/components/chat/chat";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { orpc } from "@/lib/orpc/orpc";
import {
	type Chat as ChatType,
	chatSelectSchema,
} from "@/lib/orpc/schemas/chat";
import { chatBranchSelectSchema } from "@/lib/orpc/schemas/chat-branch";

const searchSchema = z.object({
	branch: chatBranchSelectSchema.shape.id.optional(),
});

export const Route = createFileRoute("/app/chat/$chatId/")({
	beforeLoad: ({ params }) => {
		const { chatId } = params;

		if (!chatSelectSchema.shape.id.safeParse(chatId).success) {
			throw new Error("Invalid chat ID");
		}

		return {
			chatId: chatId as ChatType["id"],
		};
	},
	validateSearch: searchSchema,
	loaderDeps: ({ search: { branch } }) => ({ branch }),
	loader: async ({ context: { queryClient, chatId }, deps: { branch } }) => {
		// Fetch the chat to get activeBranchId if branch is not specified
		const chat = await queryClient.ensureQueryData(
			orpc.chat.find.queryOptions({
				input: { id: chatId },
			}),
		);

		// Use branch from URL or fallback to activeBranchId from chat
		const branchId = branch ?? chat.data.activeBranchId;

		if (!branchId) {
			throw new Error("No active branch found for chat");
		}

		const messages = await queryClient.ensureQueryData(
			orpc.chatMessage.list.queryOptions({
				input: {
					chatId,
					includeScores: true,
					branchId,
					pageSize: 100,
				},
			}),
		);

		return { messages, chat, branchId };
	},
	component: RouteComponent,
	head: ({ loaderData }) => {
		const chat = loaderData?.chat?.data;
		if (!chat) return { meta: [{ title: "Chat" }] };

		const branchId = loaderData.branchId ?? chat.activeBranchId;
		const branchName = chat.branches?.find((b) => b.id === branchId)?.name;

		const baseTitle = chat.title ?? "Chat";
		const title =
			branchName && branchName !== "Main"
				? `${baseTitle} / ${branchName}`
				: baseTitle;

		return { meta: [{ title }] };
	},
});

function RouteComponent() {
	const { chatId } = Route.useRouteContext();
	const loaderData = Route.useLoaderData();

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<Chat
				key={`${chatId}-${loaderData.branchId ?? "new"}`}
				id={chatId}
				initialMessages={loaderData.messages.data as ChatAgentUIMessage[]}
				scores={loaderData.messages.scores.data ?? []}
				branchId={loaderData.branchId}
			/>
		</div>
	);
}
