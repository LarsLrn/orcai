import { createHash } from "node:crypto";
import { ValkeyService } from "@orcai/valkey";
import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import { type Tool, type ToolExecuteFunction, tool } from "ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { type AppRuntimeContext, runPromise } from "@/lib/effect/runtime";
import { isErrorReason } from "@/lib/errors/is-error-reason";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import type { AssistantTurn } from "./turn-state";

export interface AssistantToolDeps {
	context: ORPCContext;
	turn: AssistantTurn;
}

/**
 * A failed call as the model reads it: the reason code, then the server
 * message. Serialises to its text, which is what the model is sent.
 */
export class AssistantToolError extends Error {
	override readonly name = "AssistantToolError";

	toJSON() {
		return this.message;
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const issuesText = (data: unknown) =>
	isRecord(data) && Array.isArray(data.issues)
		? data.issues
				.filter(isRecord)
				.map((issue) =>
					[
						Array.isArray(issue.path) ? issue.path.join(".") : undefined,
						issue.message,
					]
						.filter(Boolean)
						.join(": "),
				)
				.join("; ")
		: "";

/** `REASON: message`, with the code standing in for a missing reason. */
export const toolErrorText = (error: unknown): string => {
	if (error instanceof AssistantToolError) {
		return error.message;
	}

	if (error instanceof ORPCError) {
		const data: unknown = error.data;
		const reason =
			isRecord(data) && isErrorReason(data.reason) ? data.reason : error.code;

		if (error.code === "INTERNAL_SERVER_ERROR") {
			return `${reason}: The request failed on the server.`;
		}

		const message =
			error.cause instanceof Error && error.cause.message !== ""
				? error.cause.message
				: error.message;
		const issues = issuesText(data);

		return `${reason}: ${message}${issues ? ` (${issues})` : ""}`;
	}

	return "INTERNAL_SERVER_ERROR: The request failed on the server.";
};

/** The kinds of thing a tool reads or returns, as its output's `type` names them. */
export type AssistantEntityType =
	| "bot"
	| "template"
	| "repository"
	| "asset"
	| "group"
	| "member"
	| "invitation";

/** A template or a repository, where either fits. */
export type ExpectedType = AssistantEntityType | "block";

const typeLabels: Record<ExpectedType, string> = {
	bot: "bot",
	template: "template",
	repository: "repository",
	asset: "asset",
	group: "group",
	member: "member",
	invitation: "invitation",
	block: "template or repository",
};

const otherKinds: Record<ExpectedType, string[]> = {
	bot: [
		"templates",
		"repositories",
		"assets",
		"groups",
		"members",
	],
	template: [
		"bots",
		"repositories",
		"assets",
		"groups",
		"members",
	],
	repository: [
		"bots",
		"templates",
		"assets",
		"groups",
		"members",
	],
	asset: [
		"bots",
		"templates",
		"repositories",
		"groups",
		"members",
	],
	group: [
		"bots",
		"templates",
		"repositories",
		"assets",
		"members",
	],
	member: [
		"bots",
		"templates",
		"repositories",
		"assets",
		"groups",
	],
	invitation: [
		"bots",
		"templates",
		"repositories",
		"assets",
		"groups",
		"members",
	],
	block: [
		"bots",
		"assets",
		"groups",
		"members",
	],
};

/** Reasons and NOT_FOUND entities that mean "no such <type>", wrong-kind blocks included. */
const missingReasons: Record<ExpectedType, string[]> = {
	bot: [
		"BOT_NOT_FOUND",
		"bot",
	],
	template: [
		"BLOCK_NOT_FOUND",
		"BEHAVIOUR_BLOCK_TYPE_INVALID",
		"block",
	],
	repository: [
		"BLOCK_NOT_FOUND",
		"REPOSITORY_NOT_FOUND",
		"REPOSITORY_BLOCK_TYPE_INVALID",
		"block",
		"repository",
	],
	asset: [
		"ASSET_NOT_FOUND",
		"asset",
	],
	group: [
		"GROUP_NOT_FOUND",
		"group",
	],
	member: [
		"MEMBER_NOT_FOUND",
		"USER_NOT_FOUND",
		"member",
		"user",
	],
	invitation: [
		"INVITATION_NOT_FOUND",
		"invitation",
	],
	block: [
		"BLOCK_NOT_FOUND",
		"block",
	],
};

/**
 * `REASON: No group with id <id>.`, plus the hint that ids of other kinds do
 * not fit, so the model notices it passed a bot id as a group id.
 */
export const wrongIdText = (
	type: ExpectedType,
	ids: string | readonly string[],
	reason: string,
) => {
	const list =
		typeof ids === "string"
			? [
					ids,
				]
			: ids;
	const label = typeLabels[type];
	const subject =
		list.length === 1
			? `No ${label} with id ${list[0]}.`
			: `No ${label} with one of the ids ${list.join(", ")}.`;

	return `${reason}: ${subject} Ids of other kinds (${otherKinds[type].join(", ")}) are not ${label} ids.`;
};

/** The reason a failure gives for a missing `type`, if it is one. */
const missingReason = (error: unknown, type: ExpectedType) => {
	if (!(error instanceof ORPCError)) {
		return undefined;
	}

	const data: unknown = error.data;
	const reason =
		isRecord(data) && typeof data.reason === "string" ? data.reason : undefined;
	const entity =
		isRecord(data) && typeof data.entity === "string" ? data.entity : undefined;

	if (reason !== undefined) {
		return missingReasons[type].includes(reason) ? reason : undefined;
	}

	return error.code === "NOT_FOUND" &&
		(entity === undefined || missingReasons[type].includes(entity))
		? error.code
		: undefined;
};

/**
 * Applied to a call that looks `ids` up as `type`: a not-found failure about
 * that type becomes `wrongIdText`; other failures, and any failure when there
 * are no ids, pass unchanged.
 */
export const expectType =
	(type: ExpectedType, ids: string | readonly string[]) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>) =>
		effect.pipe(
			Effect.mapError((error): E | AssistantToolError => {
				const reason = ids.length > 0 ? missingReason(error, type) : undefined;

				return reason === undefined
					? error
					: new AssistantToolError(wrongIdText(type, ids, reason));
			}),
		);

const zedTokenOf = (output: unknown) =>
	isRecord(output) &&
	isRecord(output.meta) &&
	typeof output.meta.zedToken === "string"
		? output.meta.zedToken
		: undefined;

/**
 * Calls a procedure as the user, reading at the turn's newest zedToken, and
 * keeps the zedToken its output carries.
 */
export const callProcedure = <A, E>(
	{ context, turn }: AssistantToolDeps,
	call: (options: { context: ORPCContext }) => Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
	Effect.suspend(() =>
		call({
			context: {
				...context,
				meta: {
					...context.meta,
					zedToken: turn.zedToken,
				},
			},
		}),
	).pipe(
		Effect.tap((output) =>
			Effect.sync(() => {
				turn.zedToken = zedTokenOf(output) ?? turn.zedToken;
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
								),
							);
				},
			),
		);

/** A tool call as the dedup key names it: a repeat has the same id and input. */
export interface AssistantToolCall {
	/** The turn's scope; providers may reuse call ids across turns. */
	scope: string;
	toolName: string;
	toolCallId: string;
	input: unknown;
}

const CREATED_TTL_SECONDS = 24 * 60 * 60;

const createdKey = ({
	scope,
	toolName,
	toolCallId,
	input,
}: AssistantToolCall) =>
	`assistant:created:${toolName}:${createHash("sha256")
		.update(`${scope}\u0000${toolCallId}\u0000${JSON.stringify(input) ?? ""}`)
		.digest("hex")}`;

type CreatedIds = readonly [
	string,
	...string[],
];

const isCreatedIds = (ids: unknown): ids is CreatedIds =>
	Array.isArray(ids) &&
	ids.length > 0 &&
	ids.every((id) => typeof id === "string");

const createdIds = (key: string) =>
	Effect.gen(function* () {
		const { client } = yield* ValkeyService;
		const stored = yield* Effect.tryPromise(() => client.get(key));
		const ids: unknown = stored === null ? undefined : JSON.parse(stored);

		return isCreatedIds(ids) ? ids : undefined;
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.logWarning("assistant.created.read.failed", cause).pipe(
				Effect.as(undefined),
			),
		),
	);

const recordCreatedIds = (key: string, ids: readonly string[]) =>
	Effect.gen(function* () {
		const { client } = yield* ValkeyService;

		yield* Effect.tryPromise(() =>
			client.set(key, JSON.stringify(ids), {
				expiration: {
					type: "EX",
					value: CREATED_TTL_SECONDS,
				},
			}),
		);
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.logWarning("assistant.created.record.failed", cause),
		),
	);

/**
 * Creates once per tool call. The created ids are kept for a day under the
 * call's id and input, so the same call run again reads them back with
 * `replay` instead of creating again. A replay the server turns down, such as
 * for an object deleted since, creates anew.
 */
export const createOnce = <A, E, R, E2, R2>(
	call: AssistantToolCall,
	{
		create,
		ids,
		replay,
	}: {
		create: Effect.Effect<A, E, R>;
		ids: (created: A) => readonly string[];
		replay: (ids: CreatedIds) => Effect.Effect<A, E2, R2>;
	},
) =>
	Effect.gen(function* () {
		const key = createdKey(call);
		const stored = yield* createdIds(key);

		if (stored) {
			const replayed = yield* replay(stored).pipe(
				Effect.map((value) => ({
					value,
				})),
				Effect.catchIf(isRejection, () => Effect.succeed(undefined)),
			);

			if (replayed) {
				return replayed.value;
			}
		}

		return yield* create.pipe(
			Effect.tap((created) => recordCreatedIds(key, ids(created))),
			Effect.uninterruptible,
		);
	});

/**
 * Runs a tool's effect with the call's abort signal. A failure or defect
 * rejects with an `AssistantToolError`, which the SDK turns into the tool error.
 */
export const runAssistantTool = <A, E>(
	effect: Effect.Effect<A, E, AppRuntimeContext>,
	abortSignal: AbortSignal | undefined,
): Promise<A> =>
	runPromise(
		effect.pipe(
			Effect.catchCause(
				(cause): Effect.Effect<never, E | AssistantToolError> =>
					Cause.hasInterruptsOnly(cause)
						? Effect.failCause(cause)
						: Effect.fail(
								new AssistantToolError(toolErrorText(Cause.squash(cause))),
							),
			),
		),
		{
			signal: abortSignal,
		},
	);

/**
 * `tool()` with no tool context. Left to inference, a `toModelOutput` that
 * reads the output widens the context type and breaks the agent's settings.
 */
export type NoToolContext = Record<string, never>;

export const assistantTool = <Input, Output>(
	definition: Tool<Input, Output, NoToolContext> & {
		execute: ToolExecuteFunction<Input, Output, NoToolContext>;
	},
) => tool(definition);
