import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { Chat } from "@/components/chat/chat";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { orpc } from "@/lib/orpc/orpc";

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
			<Suspense fallback={<LoadingPage />}>
				<Chat
					id={chatId}
					initialMessages={messagesQuery.data.data as CustomUIMessage[]}
					scores={messagesQuery.data.scores.data}
				/>
			</Suspense>
		</div>
	);
}
