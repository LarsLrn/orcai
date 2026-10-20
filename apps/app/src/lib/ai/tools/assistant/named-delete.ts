import * as Effect from "effect/Effect";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import {
	type AssistantToolDeps,
	callProcedure,
	type ExpectedType,
	expectType,
	mutation,
} from "./procedure-tool";

type ProcedureOptions = {
	context: ORPCContext;
};

/**
 * Deletes a batch and returns the targets' names, read beforehand so the
 * summary can still show them once the targets are gone. With `canDelete`
 * only the deletable targets are sent, and the rest, unreadable ones
 * included, are skipped; without it the batch deletes everything or fails.
 */
export const deleteNamed = <
	Id extends string,
	Found,
	E,
	Type extends ExpectedType,
	FoundType extends ExpectedType = Type,
>(
	deps: AssistantToolDeps,
	ids: readonly Id[],
	{
		type,
		typeOf,
		find,
		name,
		canDelete,
		remove,
		verify,
	}: {
		/** The targets' type, and the type a missing target is reported as. */
		type: Type;
		/** A found target's own type, where `type` covers several. */
		typeOf?: (found: Found) => FoundType;
		find: (id: Id, options: ProcedureOptions) => Effect.Effect<Found, unknown>;
		name: (found: Found) => string | undefined;
		canDelete?: (found: Found) => boolean;
		remove: (ids: Id[], options: ProcedureOptions) => Effect.Effect<unknown, E>;
		/** The read tool that shows whether a failed delete went through. */
		verify: string;
	},
) =>
	Effect.gen(function* () {
		const unique = [
			...new Set(ids),
		];
		const targets = yield* Effect.forEach(
			unique,
			(id) =>
				callProcedure(deps, (options) => find(id, options)).pipe(
					Effect.map((found) => ({
						type: typeOf?.(found) ?? type,
						id,
						name: name(found),
						deletable: canDelete?.(found) ?? true,
						found: true,
					})),
					Effect.orElseSucceed(() => ({
						type,
						id,
						name: undefined,
						deletable: canDelete === undefined,
						found: false,
					})),
				),
			{
				concurrency: "unbounded",
			},
		);
		// The delete middleware refuses a whole batch for one id it does not allow.
		const sent = targets
			.filter((target) => target.deletable)
			.map((target) => target.id);
		const missing = targets
			.filter((target) => target.deletable && !target.found)
			.map((target) => target.id);

		if (sent.length > 0) {
			yield* callProcedure(deps, (options) => remove(sent, options)).pipe(
				mutation(verify),
				expectType(type, missing.length > 0 ? missing : sent),
			);
		}

		const named = ({ type, id, name }: (typeof targets)[number]) => ({
			type,
			id,
			name,
		});

		return {
			deleted: targets.filter((target) => target.deletable).map(named),
			skipped: targets.filter((target) => !target.deletable).map(named),
		};
	});
