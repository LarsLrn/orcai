import { beforeEach, describe, expect, test } from "bun:test";
import { middlewareGen } from "@orpc/effect";
import { call, ORPCError, os } from "@orpc/server";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as AppErrors from "@/lib/effect/utils/errors";
import { logProcedureError, mapEffectErrors } from "./error-mapping";

const base = os.$context<{
	"effect/context": Context.Context<never>;
	"effect/wrap": typeof mapEffectErrors;
}>();

const context = {
	"effect/context": Context.empty(),
	"effect/wrap": mapEffectErrors,
};

/** A middleware that runs `check` and then continues the chain. */
const guard = (check: Effect.Effect<void, unknown>) =>
	base.middleware(
		middlewareGen(function* ({ next }) {
			yield* check;
			return yield* next();
		}),
	);

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error("Expected a rejection");
		},
		(error: unknown) => error,
	);

const forbidden = () =>
	new AppErrors.ForbiddenError({
		reason: "PERMISSION_DENIED",
		data: {
			permission: "read",
			entityType: "organization",
		},
	});

describe("mapEffectErrors", () => {
	test("a failure further down the chain passes through every middleware unchanged", async () => {
		const downstream = new ORPCError("FORBIDDEN");
		const procedure = base
			.use(guard(Effect.void))
			.use(guard(Effect.void))
			.handler(() => {
				throw downstream;
			});

		expect(
			await rejection(
				call(procedure, undefined, {
					context,
				}),
			),
		).toBe(downstream);
	});

	test("a client abort further down the chain passes through as itself", async () => {
		const abort = new DOMException("The connection was closed.", "AbortError");
		const procedure = base.use(guard(Effect.void)).handler(() => {
			throw abort;
		});

		expect(
			await rejection(
				call(procedure, undefined, {
					context,
				}),
			),
		).toBe(abort);
	});

	test("an application error becomes its ORPCError", async () => {
		const procedure = base
			.use(guard(Effect.void))
			.use(guard(Effect.fail(forbidden())))
			.handler(() => "unreachable");

		const error = await rejection(
			call(procedure, undefined, {
				context,
			}),
		);

		expect(error).toBeInstanceOf(ORPCError);
		expect((error as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
	});

	test("a defect alongside a client error answers as an internal error", async () => {
		const procedure = base
			.use(
				guard(
					Effect.failCause(
						Cause.combine(
							Cause.fail(forbidden()),
							Cause.die(new Error("finaliser")),
						),
					),
				),
			)
			.handler(() => "unreachable");

		const error = await rejection(
			call(procedure, undefined, {
				context,
			}),
		);

		expect((error as ORPCError<string, unknown>).code).toBe(
			"INTERNAL_SERVER_ERROR",
		);
	});
});

describe("logProcedureError", () => {
	const logged: string[] = [];
	const logger = Logger.make(({ logLevel, message }) => {
		logged.push(`${logLevel} ${(message as unknown[]).join(" ")}`);
	});
	const log = (error: unknown) =>
		Effect.runSync(logProcedureError(error).pipe(Effect.withLogger(logger)));

	beforeEach(() => {
		logged.length = 0;
	});

	test("a client error is logged at info", () => {
		log(
			new ORPCError("FORBIDDEN", {
				cause: forbidden(),
			}),
		);

		expect(logged).toEqual([
			"Info ORPC procedure failed",
		]);
	});

	test("an internal error is logged at error", () => {
		log(
			new ORPCError("INTERNAL_SERVER_ERROR", {
				cause: new Error("boom"),
			}),
		);

		expect(logged).toEqual([
			"Error ORPC procedure failed",
		]);
	});

	test("a client abort is not logged", () => {
		log(new DOMException("The connection was closed.", "AbortError"));

		expect(logged).toEqual([]);
	});
});
