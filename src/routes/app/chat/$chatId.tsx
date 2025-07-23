import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { LoadingPage } from "@/components/app/loading/loading-page";
import { Chat } from "@/components/chat/chat";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { chatQueryOptions } from "@/lib/query-options/chat";
import { chatMessageQueryOptions } from "@/lib/query-options/chat-message";

export const Route = createFileRoute("/app/chat/$chatId")({
	loader: async ({ context: { queryClient }, params: { chatId } }) => {
		await queryClient.ensureQueryData(
			chatMessageQueryOptions.list({
				input: { chatId, includeScores: true },
			}),
		);

		return await queryClient.ensureQueryData(
			chatQueryOptions.find({
				input: { id: chatId },
			}),
		);
	},
	component: RouteComponent,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.data.title ?? undefined,
			},
		],
	}),
});

function RouteComponent() {
	const { chatId } = Route.useParams();

	const messagesQuery = useSuspenseQuery(
		chatMessageQueryOptions.list({
			input: { chatId, includeScores: true },
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
