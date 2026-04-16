import { botIdSchema } from "@orcai/schema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";
import { NewChat } from "@/components/chat/new-chat";

const searchSchema = z.object({
	botId: botIdSchema.optional(),
});

export const Route = createFileRoute("/app/chat/new")({
	head: () => ({
		meta: [
			{
				title: "New Chat",
			},
		],
	}),
	validateSearch: searchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { botId } = Route.useSearch();
	const navigate = useNavigate();

	return (
		<div className="-mx-2 -mb-6 h-[calc(100dvh-72px)] sm:-mx-2">
			<NewChat
				botId={botId}
				onChatCreated={(chatId, pendingMessage, zedToken) =>
					navigate({
						to: "/app/chat/$chatId",
						params: {
							chatId,
						},
						search: {
							zedToken,
						},
						state: (previous) => ({
							...previous,
							pendingMessage,
						}),
					})
				}
			/>
		</div>
	);
}
