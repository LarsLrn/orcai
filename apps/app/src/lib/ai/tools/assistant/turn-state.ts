import * as Semaphore from "effect/Semaphore";

/**
 * The newest zedToken of one assistant turn, so every procedure call sees
 * what earlier calls of the turn wrote.
 */
export interface AssistantTurn {
	zedToken: string | undefined;
	/**
	 * Runs the turn's procedure calls one at a time. Concurrent writes could
	 * record an older token last, and zedTokens cannot be compared.
	 */
	calls: Semaphore.Semaphore;
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
	calls: Semaphore.makeUnsafe(1),
	scope: `${chatId}:${replyId}`,
});
