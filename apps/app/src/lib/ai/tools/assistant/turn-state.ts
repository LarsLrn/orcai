import { createTurnZedToken, type TurnZedToken } from "@/lib/authz/zed-token";

export interface AssistantTurn {
	/** The turn's newest zedToken, which its procedure calls read at. */
	zedToken: TurnZedToken;
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
	zedToken: createTurnZedToken(zedToken),
	scope: `${chatId}:${replyId}`,
});
