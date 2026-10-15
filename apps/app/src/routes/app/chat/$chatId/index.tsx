import {
	chatBranchIdSchema,
	chatIdSchema,
	zedTokenSchema,
} from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod/v4";
import { Chat } from "@/components/chat/chat";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

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
			chatId: parseParam(chatIdSchema, params.chatId),
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
		const chat = await orNotFound(
			queryClient.query(
				orpc.chat.find.queryOptions({
					input: {
						id: chatId,
						zedToken,
					},
					staleTime: 0,
				}),
			),
		);

		// Use branch from URL or fallback to activeBranchId from chat
		const branchId = branch ?? chat.data.activeBranchId;

		if (!branchId) {
			throw new Error("No active branch found for chat");
		}

		const messages = await queryClient.query(
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
						title: m.chat_detail_page_title_fallback(),
					},
				],
			};

		const branchId = loaderData.branchId ?? chat.activeBranchId;
		const branchName = chat.branches?.find((b) => b.id === branchId)?.name;

		const baseTitle = chat.title ?? m.chat_title_placeholder();
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
	const router = useRouter();
	const { data: chat } = useQuery(
		orpc.chat.find.queryOptions({
			input: {
				id: chatId,
				zedToken,
			},
		}),
	);
	const title = chat?.data.title;
	const loadedTitle = loaderData.chat.data.title;

	// The breadcrumb and document title come from `head`, which only reruns with the loader.
	useEffect(() => {
		if (title === undefined || title === loadedTitle) return;
		void router.invalidate({
			filter: (match) => match.routeId === Route.id,
		});
	}, [
		title,
		loadedTitle,
		router,
	]);

	const initialMessages = toChatAgentMessages(loaderData.messages.data);
	const pendingMessage = useRouterState({
		select: (state) =>
			typeof state.location.state.pendingMessage === "string"
				? state.location.state.pendingMessage
				: undefined,
	});

	return (
		// The shell above the outlet takes the 48px header plus its 24px of vertical padding.
		<div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col">
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
