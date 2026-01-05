import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Chat } from "@/components/chat/chat";
import type { CustomUIMessage } from "@/lib/ai/tools";
import { orpc } from "@/lib/orpc/orpc";

export const Route = createFileRoute("/app/chat/$chatId/")({
	loader: async ({ context: { queryClient }, params: { chatId } }) => {
		await queryClient.ensureQueryData(
			orpc.chatMessage.list.queryOptions({
				input: { chatId, includeScores: true },
			}),
		);

		return await queryClient.ensureQueryData(
			orpc.chat.find.queryOptions({
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

	const { data } = useSuspenseQuery(
		orpc.chatMessage.list.queryOptions({
			input: { chatId, includeScores: true },
		}),
	);

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<Chat
				id={chatId}
				initialMessages={data.data as CustomUIMessage[]}
				scores={data.scores.data ?? []}
			/>
		</div>
	);
}
