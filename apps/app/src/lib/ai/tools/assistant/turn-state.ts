import { createTurnZedToken, type TurnZedToken } from "@/lib/authz/zed-token";
import { createTurnWrites, type TurnWrites } from "./turn-writes";

export interface AssistantTurn {
	/** The turn's newest zedToken, which its procedure calls read at. */
	zedToken: TurnZedToken;
	/** What its procedure calls wrote, for the client to refresh. */
	writes: TurnWrites;
}

export const createAssistantTurn = ({
	zedToken,
}: {
	zedToken: string | undefined;
}): AssistantTurn => ({
	zedToken: createTurnZedToken(zedToken),
	writes: createTurnWrites(),
});
