import { describe, expect, test } from "bun:test";
import { contracts } from "@orcai/contracts";
import { implement, ORPCError } from "@orpc/server";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { createProcedures } from "./procedures";

const base = implement(contracts).$context<{
	caller: string;
}>();

let seen: {
	caller: string;
	path: readonly string[];
} | null = null;
let started = Promise.withResolvers<void>();
let aborted = Promise.withResolvers<void>();

const bootstrapRouter = {
	status: base.bootstrap.status
		.use(({ context, next }) => {
			if (context.caller === "blocked") {
				throw new ORPCError("FORBIDDEN");
			}
			return next();
		})
		.handler(({ context, path }) => {
			seen = {
				caller: context.caller,
				path,
			};
			return {
				data: {
					initialized: true,
				},
			};
		}),
	initialize: base.bootstrap.initialize.handler(
		({ signal }) =>
			new Promise<never>((_, reject) => {
				signal?.addEventListener("abort", () => {
					aborted.resolve();
					reject(signal.reason);
				});
				started.resolve();
			}),
	),
};

const bootstrapProcedures = createProcedures("bootstrap", bootstrapRouter);

describe("createProcedures", () => {
	test("accepts only a contract namespace and a router implementing it", () => {
		// @ts-expect-error not a contract namespace
		createProcedures("bootstraps", bootstrapRouter);
		// @ts-expect-error the router implements another namespace
		createProcedures("block", bootstrapRouter);
	});

	test("runs the procedure and its middlewares in the caller's context", async () => {
		const result = await Effect.runPromise(
			bootstrapProcedures.status(
				{},
				{
					context: {
						caller: "alice",
					},
				},
			),
		);

		expect(result.data.initialized).toBe(true);
		expect(seen).toEqual({
			caller: "alice",
			path: [
				"bootstrap",
				"status",
			],
		});
	});

	test("fails with the middleware's ORPCError", async () => {
		const error = await Effect.runPromise(
			Effect.flip(
				bootstrapProcedures.status(
					{},
					{
						context: {
							caller: "blocked",
						},
					},
				),
			),
		);

		expect(error).toBeInstanceOf(ORPCError);
		expect(error).toMatchObject({
			code: "FORBIDDEN",
		});
	});

	test("interrupting the effect aborts the running procedure", async () => {
		started = Promise.withResolvers<void>();
		aborted = Promise.withResolvers<void>();

		const fiber = Effect.runFork(
			bootstrapProcedures.initialize(
				{
					name: "Admin",
					email: "admin@example.com",
					password: "correct horse battery staple",
					organizationName: "Example",
					organizationSlug: "example",
				},
				{
					context: {
						caller: "alice",
					},
				},
			),
		);
		await started.promise;
		await Effect.runPromise(Fiber.interrupt(fiber));

		await aborted.promise;
	});
});
