import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import "./test-procedures";
import { createAssistantTurn } from "./turn-state";

const { callProcedure, expectType, mutation } = await import(
	"./procedure-tool"
);
const { AssistantToolError, runAssistantTool } = await import("../tool-error");

const context = {
	secureCookies: false,
} as ORPCContext;

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error("expected a rejection");
		},
		(error: unknown) => error,
	);

describe("callProcedure", () => {
	test("each call reads at the newest zedToken of the turn", async () => {
		const deps = {
			context,
			turn: createAssistantTurn({
				zedToken: "request-token",
				chatId: "chat",
				replyId: "reply",
			}),
		};
		const seen: (string | undefined)[] = [];
		const call = (output: unknown) => (options: { context: ORPCContext }) =>
			Effect.sync(() => {
				seen.push(options.context.meta?.zedToken);
				return output;
			});

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* callProcedure(
					deps,
					call({
						data: {},
						meta: {
							zedToken: "after-save",
						},
					}),
				);
				yield* callProcedure(
					deps,
					call({
						data: {},
					}),
				);
				yield* callProcedure(
					deps,
					call({
						data: {},
					}),
				);
			}),
		);

		expect(seen).toEqual([
			"request-token",
			"after-save",
			"after-save",
		]);
		expect(deps.turn.zedToken).toBe("after-save");
		expect(context.meta).toBeUndefined();
	});
});

describe("expectType", () => {
	const notFound = (reason?: string) =>
		Effect.fail(
			new ORPCError("NOT_FOUND", {
				message: "Not found",
				data: reason
					? {
							reason,
						}
					: {},
			}),
		);

	test("a not-found failure names the expected type and the other kinds", async () => {
		const error = await rejection(
			runAssistantTool(
				notFound("GROUP_NOT_FOUND").pipe(expectType("group", "g-1")),
				undefined,
			),
		);

		expect((error as Error).message).toBe(
			"GROUP_NOT_FOUND: No group with id g-1. Ids of other kinds (bots, templates, repositories, assets, members) are not group ids.",
		);
	});

	test("a block of the other kind reads as a missing repository", async () => {
		const error = await rejection(
			runAssistantTool(
				Effect.fail(
					new ORPCError("BAD_REQUEST", {
						message:
							"Linked content collection block must be a database block.",
						data: {
							reason: "REPOSITORY_BLOCK_TYPE_INVALID",
						},
					}),
				).pipe(
					expectType("repository", [
						"r-1",
						"r-2",
					]),
				),
				undefined,
			),
		);

		expect((error as Error).message).toBe(
			"REPOSITORY_BLOCK_TYPE_INVALID: No repository with one of the ids r-1, r-2. Ids of other kinds (bots, templates, assets, groups, members) are not repository ids.",
		);
	});

	test("a bare NOT_FOUND counts; another type's reason passes unchanged", async () => {
		const bare = await rejection(
			runAssistantTool(notFound().pipe(expectType("bot", "b-1")), undefined),
		);
		const other = await rejection(
			runAssistantTool(
				notFound("MEMBER_NOT_FOUND").pipe(expectType("group", "g-1")),
				undefined,
			),
		);

		expect((bare as Error).message).toStartWith(
			"NOT_FOUND: No bot with id b-1.",
		);
		expect((other as Error).message).toBe("MEMBER_NOT_FOUND: Not found");
	});
});

describe("mutation", () => {
	const mutate = (effect: Effect.Effect<unknown, unknown>) =>
		rejection(runAssistantTool(effect.pipe(mutation("getBot")), undefined));

	test.each([
		[
			"an internal error",
			Effect.fail(
				new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "connection reset",
				}),
			),
			"INTERNAL_SERVER_ERROR: The request failed on the server.",
		],
		[
			"a timeout",
			Effect.fail(
				new ORPCError("TIMEOUT", {
					message: "Timed out",
				}),
			),
			"TIMEOUT: Timed out",
		],
		[
			"a defect",
			Effect.die(new Error("socket hang up")),
			"INTERNAL_SERVER_ERROR: The request failed on the server.",
		],
	])("%s says the change may have been applied", async (_, effect, reason) => {
		const error = await mutate(effect);

		expect(error).toBeInstanceOf(AssistantToolError);
		expect((error as Error).message).toBe(
			`${reason} The change may have been applied anyway; check with getBot before retrying.`,
		);
	});

	test("a rejection reads as it is", async () => {
		const error = await mutate(
			Effect.fail(
				new ORPCError("BAD_REQUEST", {
					message: "The bot needs a ready behaviour block.",
					data: {
						reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
					},
				}),
			),
		);

		expect((error as Error).message).toBe(
			"BOT_BEHAVIOUR_BLOCK_NOT_READY: The bot needs a ready behaviour block.",
		);
	});

	test("an abort while it runs waits for the change to finish", async () => {
		const controller = new AbortController();
		const started = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		let finished = false;

		const run = runAssistantTool(
			Effect.promise(() => {
				started.resolve();
				return release.promise;
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() => {
						finished = true;
					}),
				),
				mutation("getBot"),
			),
			controller.signal,
		);
		await started.promise;
		controller.abort();
		release.resolve();
		const error = await rejection(run);

		expect(finished).toBe(true);
		expect(error).not.toBeInstanceOf(AssistantToolError);
	});
});
