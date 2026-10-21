import { chatIdSchema, zedTokenSchema } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	redirect,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod/v4";
import { Chat } from "@/components/chat/chat";
import { chatDraftSchema } from "@/components/chat/chat-draft";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound, parseParam } from "@/lib/router/not-found";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	...zedTokenSchema.shape,
});

export const Route = createFileRoute("/app/chat/$chatId/")({
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
		context: { queryClient },
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

		if (chat.data.kind === "assistant") {
			throw redirect({
				to: "/app/assistant/$chatId",
				params: {
					chatId,
				},
				search: {
					zedToken,
				},
			});
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
						: m.chat_detail_page_title_fallback(),
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

	const pendingMessage = useRouterState({
		select: (state) =>
			typeof state.location.state.pendingMessage === "string"
				? state.location.state.pendingMessage
				: undefined,
	});

	const draftState = useRouterState({
		select: (state) => state.location.state.draft,
	});
	const draft = chatDraftSchema.safeParse(draftState).data;

	return (
		// The shell above the outlet takes the 48px header plus its 24px of vertical padding.
		<div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col">
			<Chat
				key={chatId}
				id={chatId}
				page={loaderData.messages}
				zedToken={zedToken}
				pendingMessage={pendingMessage}
				draft={draft}
			/>
		</div>
	);
}
