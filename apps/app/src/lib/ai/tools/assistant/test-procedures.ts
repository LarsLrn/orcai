import { mock } from "bun:test";
import { type ValkeyClient, ValkeyService } from "@orcai/valkey";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
	type ProcedureClients,
	Procedures,
} from "@/lib/orpc/implementation/procedures";

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

/** What the fake Valkey client holds, by key. */
export const valkeyStore = new Map<string, string>();

export const resetProcedures = () => {
	procedureCalls.length = 0;
	valkeyStore.clear();
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
					? (input: unknown) =>
							Effect.suspend(() => {
								const procedure = `${namespace}.${name}`;
								procedureCalls.push({
									procedure,
									input,
								});
								const answer = answers[procedure];

								return answer
									? answer(input as never)
									: Effect.die(new Error(`unexpected call to ${procedure}`));
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

const fakeValkey = {
	client: {
		get: (key: string) => Promise.resolve(valkeyStore.get(key) ?? null),
		set: (key: string, value: string) => {
			valkeyStore.set(key, value);
			return Promise.resolve("OK");
		},
	} as unknown as ValkeyClient,
};

/** The fake Valkey and procedure clients. */
export const FakeServices = Layer.mergeAll(
	Layer.succeed(ValkeyService, fakeValkey),
	Layer.succeed(Procedures, fakeProcedures),
);

/** Runs with the fakes; the real runtime builds the app's layers, which need its configuration. */
export const runPromise = <A, E>(
	effect: Effect.Effect<A, E, ValkeyService | Procedures>,
	options?: Effect.RunOptions,
) => Effect.runPromise(Effect.provide(effect, FakeServices), options);

mock.module("@/lib/effect/runtime", () => ({
	runtime: {
		runPromise,
	},
	ensureRuntimeReady: () => Promise.resolve(),
	runPromise,
}));
