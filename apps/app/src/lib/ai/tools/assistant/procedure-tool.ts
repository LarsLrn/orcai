import { createHash } from "node:crypto";
import { ValkeyService } from "@orcai/valkey";
import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import {
	type FlexibleSchema,
	type Tool,
	type ToolExecuteFunction,
	type ToolExecutionOptions,
	type ToolResultPart,
	tool,
} from "ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import {
	type EntityKind,
	isMissing,
	wrongIdText,
} from "@/lib/ai/tools/entity-kind";
import type { AppRuntimeContext } from "@/lib/effect/runtime";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	type ProcedureClients,
	Procedures,
} from "@/lib/orpc/implementation/procedures";
import {
	AssistantToolError,
	isRecord,
	runAssistantTool,
	toolErrorText,
} from "../tool-error";
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
 * Calls a procedure as the user, reading at the turn's newest zedToken, and
 * keeps the zedToken its output carries. The turn's calls run one at a time.
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
						zedToken,
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
								),
							);
				},
			),
		);

/** A tool call as the dedup key names it: a repeat has the same id and input. */
export interface AssistantToolCall {
	/** The turn's scope; providers may reuse call ids across turns. */
	scope: string;
	toolCallId: string;
	input: unknown;
}

const CREATED_TTL_SECONDS = 24 * 60 * 60;

const createdKey = ({ scope, toolCallId, input }: AssistantToolCall) =>
	`assistant:created:${createHash("sha256")
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
 * `tool()` with no tool context. Left to inference, a `toModelOutput` that
 * reads the output widens the context type and breaks the agent's settings.
 */
export type NoToolContext = Record<string, never>;

export type AssistantTool<Input, Output> = Tool<
	Input,
	Output,
	NoToolContext
> & {
	execute: ToolExecuteFunction<Input, Output, NoToolContext>;
};

export const assistantTool = <Input, Output>(
	definition: AssistantTool<Input, Output>,
): AssistantTool<Input, Output> => tool(definition);

/**
 * A tool whose call runs `run` with the call's abort signal. A failure or
 * defect becomes the tool error the model reads.
 */
export const effectTool = <Input, Output>({
	run,
	...definition
}: {
	description: string;
	inputSchema: FlexibleSchema<Input>;
	run: (
		input: Input,
		options: ToolExecutionOptions<NoToolContext>,
	) => Effect.Effect<Output, unknown, AppRuntimeContext>;
	toModelOutput?: (options: {
		toolCallId: string;
		input: Input;
		output: Output;
	}) => ToolResultPart["output"];
}): AssistantTool<Input, Output> =>
	// The SDK's conditional tool types do not resolve over a generic Input and Output.
	({
		...definition,
		execute: (input: Input, options: ToolExecutionOptions<NoToolContext>) =>
			runAssistantTool(run(input, options), options.abortSignal),
	}) as unknown as AssistantTool<Input, Output>;
