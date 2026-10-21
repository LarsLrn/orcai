import { describe, expect, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import * as Effect from "effect/Effect";
import "./assistant/test-procedures";

const { AssistantToolError, runAssistantTool } = await import("./tool-error");

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error("expected a rejection");
		},
		(error: unknown) => error,
	);

describe("runAssistantTool", () => {
	test("aborting the signal interrupts the effect", async () => {
		const controller = new AbortController();
		const started = Promise.withResolvers<void>();
		let interrupted = false;

		const run = runAssistantTool(
			Effect.sync(() => started.resolve()).pipe(
				Effect.andThen(Effect.never),
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						interrupted = true;
					}),
				),
			),
			controller.signal,
		);
		await started.promise;
		controller.abort();

		const error = await rejection(run);

		expect(interrupted).toBe(true);
		expect(error).not.toBeInstanceOf(AssistantToolError);
	});

	test("a failed call rejects with its reason and message", async () => {
		const error = await rejection(
			runAssistantTool(
				Effect.fail(
					new ORPCError("FORBIDDEN", {
						message: "You do not have permission to edit this bot.",
						data: {
							reason: "PERMISSION_DENIED",
						},
					}),
				),
				undefined,
			),
		);

		expect(error).toBeInstanceOf(AssistantToolError);
		expect((error as Error).message).toBe(
			"PERMISSION_DENIED: You do not have permission to edit this bot.",
		);
		expect(JSON.stringify(error)).toBe(
			JSON.stringify(
				"PERMISSION_DENIED: You do not have permission to edit this bot.",
			),
		);
	});

	test("the code stands in for a missing reason", async () => {
		const error = await rejection(
			runAssistantTool(
				Effect.fail(
					new ORPCError("NOT_FOUND", {
						message: "Bot not found",
					}),
				),
				undefined,
			),
		);

		expect((error as Error).message).toBe("NOT_FOUND: Bot not found");
	});

	test.each([
		[
			"an internal ORPCError",
			Effect.fail(
				new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "connection to db-primary:5432 refused",
				}),
			),
		],
		[
			"a defect",
			Effect.die(new Error("connection to db-primary:5432 refused")),
		],
		[
			"a plain failure",
			Effect.fail(new Error("connection to db-primary:5432 refused")),
		],
	])("%s does not leak its message", async (_, effect) => {
		const error = await rejection(runAssistantTool(effect, undefined));

		expect(error).toBeInstanceOf(AssistantToolError);
		expect((error as Error).message).toBe(
			"INTERNAL_SERVER_ERROR: The request failed on the server.",
		);
	});
});
