import { mock } from "bun:test";
import { type ValkeyClient, ValkeyService } from "@orcai/valkey";
import * as Effect from "effect/Effect";

/**
 * Every assistant tool test mocks the procedure clients here, with one shape,
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

const fakeProcedures = (namespace: string) =>
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

for (const [file, namespace] of [
	[
		"asset",
		"asset",
	],
	[
		"authorization",
		"authorization",
	],
	[
		"block",
		"block",
	],
	[
		"bot",
		"bot",
	],
	[
		"group",
		"group",
	],
	[
		"job",
		"job",
	],
	[
		"organization-invitation",
		"organizationInvitation",
	],
	[
		"organization-member",
		"organizationMember",
	],
	[
		"resource",
		"resource",
	],
	[
		"user",
		"user",
	],
] as const) {
	mock.module(`@/lib/orpc/router/${file}`, () => ({
		[`${namespace}Router`]: {},
		[`${namespace}Procedures`]: fakeProcedures(namespace),
	}));
}

const fakeValkey = {
	client: {
		get: (key: string) => Promise.resolve(valkeyStore.get(key) ?? null),
		set: (key: string, value: string) => {
			valkeyStore.set(key, value);
			return Promise.resolve("OK");
		},
	} as unknown as ValkeyClient,
};

// The real runtime builds the app's layers, which need its configuration.
const runPromise = <A, E>(
	effect: Effect.Effect<A, E, ValkeyService>,
	options?: Effect.RunOptions,
) =>
	Effect.runPromise(
		Effect.provideService(effect, ValkeyService, fakeValkey),
		options,
	);

mock.module("@/lib/effect/runtime", () => ({
	runtime: {
		runPromise,
	},
	ensureRuntimeReady: () => Promise.resolve(),
	runPromise,
}));
