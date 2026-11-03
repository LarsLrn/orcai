import { createTurnZedToken, type TurnZedToken } from "@/lib/authz/zed-token";

export interface AssistantTurn {
	/** The turn's newest zedToken, which its procedure calls read at. */
	zedToken: TurnZedToken;
}

export const createAssistantTurn = ({
	zedToken,
}: {
	zedToken: string | undefined;
}): AssistantTurn => ({
	zedToken: createTurnZedToken(zedToken),
});
