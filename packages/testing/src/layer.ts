import { afterAll, beforeAll } from "bun:test";
import { DB, DrizzleLive, dbSchema } from "@orcai/db";
import { SpiceDbLive } from "@orcai/spice-db";
import { count } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";

// Bootstrap treats any user or organization as an initialized instance, so a
// test row on a fresh stack would lock first-run setup until the next reset.
const requireInitializedInstance = Effect.gen(function* () {
	const db = yield* DB;
	const [[users], [organizations]] = yield* Effect.all([
		db
			.select({
				count: count(),
			})
			.from(dbSchema.user),
		db
			.select({
				count: count(),
			})
			.from(dbSchema.organization),
	]);
	if (Number(users.count) === 0 && Number(organizations.count) === 0) {
		return yield* Effect.fail(
			new Error(
				"The stack's instance is not initialized. Complete /init or run `bun run stack e2e` before the integration tier.",
			),
		);
	}
});

/** The app's DB and SpiceDB services, built from the stack environment. */
export const IntegrationLive = Layer.effectDiscard(
	requireInitializedInstance,
).pipe(Layer.provideMerge(Layer.mergeAll(DrizzleLive, SpiceDbLive)));

type IntegrationServices = Layer.Success<typeof IntegrationLive>;
type IntegrationError = Layer.Error<typeof IntegrationLive>;

const BUILD_TIMEOUT = 60_000;

/**
 * The test file's runtime over the stack's DB and SpiceDB and `layer`, built
 * before its first test, so no test carries the build, and disposed after its
 * last.
 */
export function integrationRuntime(): ManagedRuntime.ManagedRuntime<
	IntegrationServices,
	IntegrationError
>;
export function integrationRuntime<A, E>(
	layer: Layer.Layer<A, E, IntegrationServices>,
): ManagedRuntime.ManagedRuntime<A | IntegrationServices, E | IntegrationError>;
export function integrationRuntime<A, E>(
	layer?: Layer.Layer<A, E, IntegrationServices>,
) {
	const runtime = ManagedRuntime.make(
		layer ? layer.pipe(Layer.provideMerge(IntegrationLive)) : IntegrationLive,
	);
	beforeAll(() => runtime.context(), BUILD_TIMEOUT);
	afterAll(() => runtime.dispose());
	return runtime;
}
