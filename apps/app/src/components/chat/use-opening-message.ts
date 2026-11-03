import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatSession } from "@/lib/ai/chat-session/chat-session";
import { reasonMessageOf } from "@/lib/errors/describe-error";
import { m } from "@/paraglide/messages";
import { type ChatDraft, outgoingMessageOf } from "./chat-draft";

/**
 * Sends the opening message of a chat just created, once. One that never
 * reached the transcript comes back as the composer's draft, which `version`
 * marks so the composer takes it up.
 */
export const useOpeningMessage = ({
	session,
	pendingMessage,
	draft,
}: {
	session: Pick<ChatSession, "sendFirst">;
	pendingMessage: ChatDraft | undefined;
	/** The composer's draft until an opening message comes back. */
	draft: ChatDraft | undefined;
}) => {
	const [composerDraft, setComposerDraft] = useState({
		draft,
		version: 0,
	});

	useEffect(() => {
		if (!pendingMessage) return;
		session.sendFirst(outgoingMessageOf(pendingMessage))?.then(
			(reached) => {
				if (reached) return;
				setComposerDraft(({ version }) => ({
					draft: pendingMessage,
					version: version + 1,
				}));
			},
			(error: unknown) => {
				toast.error(m.chat_pending_message_failed_toast_error(), {
					description: reasonMessageOf(error),
				});
			},
		);
	}, [
		session,
		pendingMessage,
	]);

	return composerDraft;
};
