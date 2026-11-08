import { createTurnZedToken, type TurnZedToken } from "@/lib/authz/zed-token";
import { createRunningCalls, type RunningCalls } from "./running-calls";
import { createTurnWrites, type TurnWrites } from "./turn-writes";

export interface AssistantTurn {
	/** The turn's newest zedToken, which its procedure calls read at. */
	zedToken: TurnZedToken;
	/** What its procedure calls wrote, for the client to refresh. */
	writes: TurnWrites;
	calls: RunningCalls;
}

export const createAssistantTurn = ({
	zedToken,
	runningCallsWait,
}: {
	zedToken: string | undefined;
	/** Bounds the wait for running calls once the turn stopped. */
	runningCallsWait?: () => AbortSignal;
}): AssistantTurn => ({
	zedToken: createTurnZedToken(zedToken),
	writes: createTurnWrites(),
	calls: createRunningCalls(runningCallsWait),
});
