import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod/v4";
import {
	AssistantHistory,
	assistantHistoryQuery,
} from "@/components/assistant/assistant-history";
import { AssistantNewConversation } from "@/components/assistant/assistant-new-conversation";
import { loadAssistantModel } from "@/components/assistant/use-assistant-model";

const searchSchema = z.object({
	draft: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/app/assistant/")({
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient, auth } }) => {
		await Promise.allSettled([
			loadAssistantModel(queryClient, auth.session.activeOrganizationId, {
				quota: true,
			}),
			queryClient.query(assistantHistoryQuery()),
		]);
	},
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
			<AssistantNewConversation initialText={initialDraft} />
			<AssistantHistory />
		</div>
	);
}
