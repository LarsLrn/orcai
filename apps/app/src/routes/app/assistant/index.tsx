import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod/v4";
import { AssistantHistory } from "@/components/assistant/assistant-history";
import { AssistantNewConversation } from "@/components/assistant/assistant-new-conversation";

const searchSchema = z.object({
	draft: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/app/assistant/")({
	validateSearch: searchSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { draft } = Route.useSearch();
	const [initialDraft] = useState(draft);

	useEffect(() => {
		if (draft === undefined) return;
		void navigate({
			to: ".",
			search: {},
			replace: true,
		});
	}, [
		draft,
		navigate,
	]);

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-2 py-4">
			<AssistantNewConversation
				initialText={initialDraft}
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
