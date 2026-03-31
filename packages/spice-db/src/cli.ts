import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { runConvergeStatus, runConvergeUp } from "./converge";
import { SpiceDbCliError } from "./errors";
import { SpiceDbLive } from "./service";

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
		default:
			return Effect.fail(
				new SpiceDbCliError({
					message: `Unknown command '${value}'. Use one of: up, status, dry-run`,
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
