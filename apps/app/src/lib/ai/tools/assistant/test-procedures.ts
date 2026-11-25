import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	type ProcedureClients,
	Procedures,
} from "@/lib/orpc/implementation/procedures";
import type { ProcedureOptions } from "./procedure-tool";

/**
 * Every assistant tool test fakes the procedure clients here, with one shape,
 * and sets `answers` per test.
 */

type Answer = (input: never) => Effect.Effect<unknown, unknown>;

/** Calls by `namespace.name`, in order. */
export const procedureCalls: {
	procedure: string;
	input: unknown;
}[] = [];

/** Answers by `namespace.name`; any other call dies. */
export const answers: Record<string, Answer> = {};

export const resetProcedures = () => {
	procedureCalls.length = 0;
	for (const procedure of Object.keys(answers)) {
		delete answers[procedure];
	}
};

const fakeNamespace = (namespace: string) =>
	new Proxy(
		{},
		{
			get: (_, name) =>
				typeof name === "string"
					? (input: unknown, options?: ProcedureOptions) =>
							Effect.suspend(() => {
								const procedure = `${namespace}.${name}`;
								procedureCalls.push({
									procedure,
									input,
								});
								const answer = answers[procedure];
								if (!answer) {
									return Effect.die(
										new Error(`unexpected call to ${procedure}`),
									);
								}

								// As the real clients' interceptor does.
								const turnWrites = options?.context.meta?.turnWrites;
								return answer(input as never).pipe(
									Effect.tap((output) =>
										Effect.sync(() =>
											turnWrites?.record(
												[
													namespace,
													name,
												],
												input,
												output,
											),
										),
									),
								);
							})
					: undefined,
		},
	);

const fakeProcedures = new Proxy(
	{},
	{
		get: (_, namespace) =>
			typeof namespace === "string" ? fakeNamespace(namespace) : undefined,
	},
) as ProcedureClients;

/** The fake procedure clients. */
export const FakeServices = Layer.succeed(Procedures, fakeProcedures);

/** A request context whose effects, tool runs among them, call the fakes. */
export const fakeContext = {
	secureCookies: false,
	"effect/context": Context.make(Procedures, fakeProcedures),
} as ORPCContext;

/** Runs with the fakes; the real runtime builds the app's layers, which need its configuration. */
export const runPromise = <A, E>(
	effect: Effect.Effect<A, E, Procedures>,
	options?: Effect.RunOptions,
) => Effect.runPromise(Effect.provide(effect, FakeServices), options);
