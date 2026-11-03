import type { ChatId } from "@orcai/core";
import type { ChatKind } from "@orcai/schema";
import { type MutationFunction, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ChatDraft } from "@/components/chat/chat-draft";
import { callProcedure } from "@/hooks/actions/use-mutation-action";

/**
 * Creates a chat and opens it, which sends the draft as its first message.
 * `start` resolves whether the chat opened, so a failed start gives the draft back.
 */
const useStartChat = <TInput>({
	create,
	errorToast,
}: {
	/** The create procedure's mutation options. */
	create: {
		mutationFn?: MutationFunction<
			{
				data: {
					id: ChatId;
					kind: ChatKind;
				};
				meta?: {
					zedToken?: string;
				};
			},
			TInput
		>;
	};
	errorToast: string;
}) => {
	const navigate = useNavigate();
	// Opening the chat is part of starting it, so its failure toasts too.
	const { mutateAsync, isPending } = useMutation({
		mutationFn: async (
			{
				input,
				draft,
			}: {
				input: TInput;
				draft: ChatDraft;
			},
			context,
		) => {
			const { data, meta } = await callProcedure(create, context)(input);
			await navigate({
				to:
					data.kind === "assistant"
						? "/app/assistant/$chatId"
						: "/app/chat/$chatId",
				params: {
					chatId: data.id,
				},
				search: {
					zedToken: meta?.zedToken,
				},
				state: (previous) => ({
					...previous,
					pendingMessage: draft,
				}),
			});
		},
		meta: {
			errorToast,
		},
	});

	return {
		isStarting: isPending,
		start: (input: TInput, draft: ChatDraft) =>
			mutateAsync({
				input,
				draft,
			}).then(
				() => true,
				() => false,
			),
	};
};

export { useStartChat };
