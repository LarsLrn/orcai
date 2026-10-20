/**
 * The newest zedToken of one assistant turn, so every procedure call sees
 * what earlier calls of the turn wrote.
 */
export interface AssistantTurn {
	zedToken: string | undefined;
	/** The chat and reply the turn writes, which scope its tool call ids. */
	scope: string;
}

export const createAssistantTurn = ({
	zedToken,
	chatId,
	replyId,
}: {
	zedToken: string | undefined;
	chatId: string;
	replyId: string;
}): AssistantTurn => ({
	zedToken,
	scope: `${chatId}:${replyId}`,
});
