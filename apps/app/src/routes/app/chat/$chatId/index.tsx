import {
	chatBranchIdSchema,
	chatIdSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { z } from "zod/v4";
import { Chat } from "@/components/chat/chat";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { orpc } from "@/lib/orpc/orpc";

const searchSchema = z.object({
	branch: chatBranchIdSchema.optional(),
	...zedTokenSchema.shape,
});

// Unfortunately required for now to restore types after route validation, since UI Messages are dynamically inferred based on available tools, metadata and more, which makes it impossible to statically define the shape in the @orcai/schema package.
const toChatAgentMessages = (messages: unknown[]): ChatAgentUIMessage[] =>
	messages as ChatAgentUIMessage[];

export const Route = createFileRoute("/app/chat/$chatId/")({
	validateSearch: searchSchema,
	params: {
		parse: (params) => ({
			chatId: chatIdSchema.parse(params.chatId),
		}),
	},
	loaderDeps: ({ search: { branch, zedToken } }) => ({
		branch,
		zedToken,
	}),
	loader: async ({
		params: { chatId },
		context: { queryClient },
		deps: { branch, zedToken },
	}) => {
		// Fetch the chat to get activeBranchId if branch is not specified
		const chat = await queryClient.fetchQuery(
			orpc.chat.find.queryOptions({
				input: {
					id: chatId,
					zedToken,
				},
				staleTime: 0,
			}),
		);

		// Use branch from URL or fallback to activeBranchId from chat
		const branchId = branch ?? chat.data.activeBranchId;

		if (!branchId) {
			throw new Error("No active branch found for chat");
		}

		const messages = await queryClient.fetchQuery(
			orpc.chatMessage.list.queryOptions({
				input: {
					chatId,
					includeScores: true,
					branchId,
					pageSize: 100,
					zedToken,
				},
				staleTime: 0,
			}),
		);

		return {
			messages,
			chat,
			branchId,
		};
	},
	component: RouteComponent,
	head: ({ loaderData }) => {
		const chat = loaderData?.chat?.data;
		if (!chat)
			return {
				meta: [
					{
						title: "Chat",
					},
				],
			};

		const branchId = loaderData.branchId ?? chat.activeBranchId;
		const branchName = chat.branches?.find((b) => b.id === branchId)?.name;

		const baseTitle = chat.title ?? "Chat";
		const title =
			branchName && branchName !== "Main"
				? `${baseTitle} / ${branchName}`
				: baseTitle;

		return {
			meta: [
				{
					title,
				},
			],
		};
	},
});

function RouteComponent() {
	const { chatId } = Route.useParams();
	const loaderData = Route.useLoaderData();
	const { zedToken } = Route.useSearch();
	const initialMessages = toChatAgentMessages(loaderData.messages.data);
	const pendingMessage = useRouterState({
		select: (state) =>
			typeof state.location.state.pendingMessage === "string"
				? state.location.state.pendingMessage
				: undefined,
	});

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<Chat
				key={`${chatId}-${loaderData.branchId ?? "new"}`}
				id={chatId}
				initialMessages={initialMessages}
				branchId={loaderData.branchId}
				zedToken={zedToken}
				pendingMessage={pendingMessage}
			/>
		</div>
	);
}
