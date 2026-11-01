import * as Effect from "effect/Effect";
import type { EntityKind } from "@/lib/ai/tools/entity-kind";
import type { ProcedureClients } from "@/lib/orpc/implementation/procedures";
import {
	type AssistantToolDeps,
	callProcedure,
	expectType,
	mutation,
	type ProcedureOptions,
} from "./procedure-tool";

/**
 * Deletes a batch and returns the targets' names, read beforehand so the
 * summary can still show them once the targets are gone, with what the
 * delete returned when it ran. With `canDelete`
 * only the deletable targets are sent, and the rest, unreadable ones
 * included, are skipped; without it the batch deletes everything or fails.
 */
export const deleteNamed = <
	Id extends string,
	Found,
	Removed,
	E,
	Kind extends EntityKind,
	FoundKind extends EntityKind = Kind,
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
		/** The targets' kind, and the kind a missing target is reported as. */
		type: Kind;
		/** A found target's own kind, where `type` covers several. */
		typeOf?: (found: Found) => FoundKind;
		find: (
			id: Id,
			procedures: ProcedureClients,
			options: ProcedureOptions,
		) => Effect.Effect<Found, unknown>;
		name: (found: Found) => string | undefined;
		canDelete?: (found: Found) => boolean;
		remove: (
			ids: Id[],
			procedures: ProcedureClients,
			options: ProcedureOptions,
		) => Effect.Effect<Removed, E>;
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
				callProcedure(deps, (procedures, options) =>
					find(id, procedures, options),
				).pipe(
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

		const removed =
			sent.length > 0
				? yield* callProcedure(deps, (procedures, options) =>
						remove(sent, procedures, options),
					).pipe(
						mutation(verify),
						expectType(type, missing.length > 0 ? missing : sent),
					)
				: undefined;

		const named = ({ type, id, name }: (typeof targets)[number]) => ({
			type,
			id,
			name,
		});

		return {
			deleted: targets.filter((target) => target.deletable).map(named),
			skipped: targets.filter((target) => !target.deletable).map(named),
			removed,
		};
	});
