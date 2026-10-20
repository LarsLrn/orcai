import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AssistantHistory } from "@/components/assistant/assistant-history";
import { AssistantNewConversation } from "@/components/assistant/assistant-new-conversation";

export const Route = createFileRoute("/app/assistant/")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-2 py-4">
			<AssistantNewConversation
				onConversationCreated={(chatId, pendingMessage, zedToken) =>
					navigate({
						to: "/app/assistant/$chatId",
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
			<AssistantHistory />
		</div>
	);
}
