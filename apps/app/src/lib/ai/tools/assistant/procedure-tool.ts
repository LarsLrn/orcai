import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import {
	type EntityKind,
	isMissing,
	wrongIdText,
} from "@/lib/ai/tools/entity-kind";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	type ProcedureClients,
	Procedures,
} from "@/lib/orpc/implementation/procedures";
import { AssistantToolError, isRecord, toolErrorText } from "../tool-error";
import type { AssistantTurn } from "./turn-state";

export interface ProcedureOptions {
	context: ORPCContext;
}

export interface AssistantToolDeps {
	context: ORPCContext;
	turn: AssistantTurn;
}

/** The reason a failure gives for a missing `kind`, if it is one. */
const missingReason = (error: unknown, kind: EntityKind) => {
	if (!(error instanceof ORPCError)) {
		return undefined;
	}

	const data: unknown = error.data;
	const reason =
		isRecord(data) && typeof data.reason === "string" ? data.reason : undefined;
	const entity =
		isRecord(data) && typeof data.entity === "string" ? data.entity : undefined;

	if (reason === undefined && error.code !== "NOT_FOUND") {
		return undefined;
	}

	return isMissing(kind, {
		reason,
		entity,
	})
		? (reason ?? error.code)
		: undefined;
};

/**
 * Applied to a call that looks `ids` up as `kind`: a not-found failure about
 * that kind becomes `wrongIdText`; other failures, and any failure when there
 * are no ids, pass unchanged.
 */
export const expectType =
	(kind: EntityKind, ids: string | readonly string[]) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.mapError((error): E | AssistantToolError => {
				const reason = ids.length > 0 ? missingReason(error, kind) : undefined;

				return reason === undefined
					? error
					: new AssistantToolError(wrongIdText(kind, ids, reason));
			}),
		);

/**
 * Calls a procedure as the user, reading at least at the turn's newest
 * zedToken beside the request's, and keeps the zedToken its output carries
 * and what it wrote. The turn's calls run one at a time.
 */
export const callProcedure = <A, E>(
	{ context, turn }: AssistantToolDeps,
	call: (
		procedures: ProcedureClients,
		options: ProcedureOptions,
	) => Effect.Effect<A, E>,
): Effect.Effect<A, E, Procedures> =>
	turn.zedToken.run((zedToken) =>
		Procedures.use((procedures) =>
			call(procedures, {
				context: {
					...context,
					meta: {
						...context.meta,
						turnZedToken: zedToken,
						turnWrites: turn.writes,
					},
				},
			}),
		),
	);

const statusOf = (code: string): number | undefined =>
	(COMMON_ERROR_STATUS_MAP as Record<string, number>)[code];

/** A failure that proves the server turned the change down; a timeout or a closed request does not. */
const isRejection = (error: unknown) => {
	if (error instanceof AssistantToolError) {
		return true;
	}

	if (
		!(error instanceof ORPCError) ||
		error.code === "TIMEOUT" ||
		error.code === "CLIENT_CLOSED_REQUEST"
	) {
		return false;
	}

	const status = statusOf(error.code);

	return status !== undefined && status >= 400 && status < 500;
};

/**
 * Marks the call that changes something. Once started it runs to its end, and
 * a failure that does not prove the change was turned down tells the model to
 * check with `verify`, a read tool, before retrying.
 */
export const mutation =
	(verify: string) =>
	<A, E, R>(
		effect: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | AssistantToolError, R> =>
		Effect.uninterruptible(effect).pipe(
			Effect.catchCause(
				(cause): Effect.Effect<never, E | AssistantToolError> => {
					const error = Cause.squash(cause);

					return Cause.hasInterruptsOnly(cause) || isRejection(error)
						? Effect.failCause(cause)
						: Effect.fail(
								new AssistantToolError(
									`${toolErrorText(error)} The change may have been applied anyway; check with ${verify} before retrying.`,
									{
										cause: error,
									},
								),
							);
				},
			),
		);
