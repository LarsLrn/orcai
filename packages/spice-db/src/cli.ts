import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { runConvergeStatus, runConvergeUp } from "./converge";
import { SpiceDbCliError } from "./errors";
import { resetRelationships } from "./reset";
import { SpiceDbLive } from "./service";

const affirmatives = new Set([
	"y",
	"yes",
]);

/**
 * Ask before deleting relationships. `--yes` skips the question, which every
 * non-interactive caller has to pass.
 */
const confirmReset = Effect.gen(function* () {
	if (process.argv.includes("--yes")) return;

	const endpoint = process.env.SPICEDB_ENDPOINT ?? "the configured endpoint";
	const warning = `This deletes every relationship on ${endpoint}.`;

	if (!process.stdin.isTTY) {
		return yield* Effect.fail(
			new SpiceDbCliError({
				message: `${warning} Pass --yes to confirm non-interactively.`,
			}),
		);
	}

	const answer = yield* Effect.sync(() => prompt(`${warning} Continue? [y/N]`));
	if (!affirmatives.has((answer ?? "").trim().toLowerCase())) {
		return yield* Effect.fail(
			new SpiceDbCliError({
				message: "Aborted.",
			}),
		);
	}
});

const resolveProgram = (value: string): Effect.Effect<void, unknown, never> => {
	switch (value) {
		case "status":
			return runConvergeStatus().pipe(Effect.provide(SpiceDbLive));
		case "dry-run":
			return runConvergeUp({
				dryRun: true,
			}).pipe(Effect.provide(SpiceDbLive));
		case "up":
			return runConvergeUp().pipe(Effect.provide(SpiceDbLive));
		case "reset":
			/** Confirm before the layer connects, so a declined reset never opens a client. */
			return confirmReset.pipe(
				Effect.andThen(
					resetRelationships.pipe(
						Effect.tap(({ resourceTypes, deleted }) =>
							Effect.logInfo(
								`Deleted ${String(deleted)} relationships across ${String(resourceTypes)} resource types`,
							),
						),
						Effect.asVoid,
						Effect.provide(SpiceDbLive),
					),
				),
			);
		default:
			return Effect.fail(
				new SpiceDbCliError({
					message: `Unknown command '${value}'. Use one of: up, status, dry-run, reset`,
				}),
			);
	}
};

const command = process.argv[2] ?? "up";
const exit = await Effect.runPromiseExit(resolveProgram(command));

if (Exit.isFailure(exit)) {
	console.error(Cause.pretty(exit.cause));
	process.exit(1);
}
