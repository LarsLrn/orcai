import { chatIdSchema, zedTokenSchema } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	notFound,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod/v4";
import { Chat } from "@/components/chat/chat";
import { toChatAgentMessages } from "@/components/chat/chat-history";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";
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
	loader: async ({
		params: { chatId },
		context: { queryClient, auth },
		deps: { zedToken },
	}) => {
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

		// Readable from any organisation over the API, but only shown in its own.
		if (
			chat.data.kind !== "assistant" ||
			chat.data.organizationId !== auth.session.activeOrganizationId
		) {
			throw notFound();
		}

		const messages = await queryClient.query(
			orpc.chatMessage.list.queryOptions({
				input: {
					chatId,
					zedToken,
				},
				staleTime: 0,
			}),
		);

		return {
			messages,
			chat,
		};
	},
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
				key={chatId}
				id={chatId}
				initialMessages={initialMessages}
				initialBefore={loaderData.messages.data[0]?.position}
				initialHasMore={loaderData.messages.hasMore}
				zedToken={zedToken}
				pendingMessage={pendingMessage}
				variant="assistant"
			/>
		</div>
	);
}
