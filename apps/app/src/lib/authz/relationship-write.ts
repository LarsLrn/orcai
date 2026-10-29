import type { OrganizationId } from "@orcai/core";
import { advisoryXactLock, DB, retryDeadlocks } from "@orcai/db";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import {
	projectRelationshipFacts,
	type RelationshipFact,
} from "@/lib/authz/relationship-facts";
import {
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";

/** Collects the relationship facts of the enclosing {@link writeRelationships}. */
class RelationshipFacts extends Context.Service<
	RelationshipFacts,
	{
		readonly record: (
			facts: readonly RelationshipFact[],
		) => Effect.Effect<void>;
	}
>()("RelationshipFacts") {}

export const recordRelationshipFacts = (...facts: RelationshipFact[]) =>
	RelationshipFacts.use((collector) => collector.record(facts));

const ORGANIZATION_LOCK_SPACE = 72370906;

const lockOrganization = (organizationId: OrganizationId) =>
	advisoryXactLock(ORGANIZATION_LOCK_SPACE, organizationId);

class ScopeGrew extends Data.TaggedError("ScopeGrew")<{
	readonly organizationIds: readonly OrganizationId[];
}> {}

/**
 * Runs `body` as the one transaction that changes rows and relationships
 * together. It first takes each organization's write lock, so writers in one
 * organization run one after another, then enqueues the tuple changes of the
 * facts `body` records before committing. After the commit it delivers them
 * and records the zedToken; a failed delivery is logged and left to the
 * outbox loop, so the write still succeeds.
 *
 * A deadlocked transaction runs again.
 *
 * When `organizationIds` is an effect, it is read again under the locks; if
 * it names an organization not yet locked, the transaction starts over with
 * that one locked too.
 */
export const writeRelationships = <A, E, R, ES = never, RS = never>(
	scope: {
		organizationIds:
			| Iterable<OrganizationId>
			| Effect.Effect<Iterable<OrganizationId>, ES, RS>;
	},
	body: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;
		const { organizationIds } = scope;
		const readScope = Effect.isEffect(organizationIds)
			? organizationIds
			: undefined;

		const write = (locked: ReadonlySet<OrganizationId>) =>
			retryDeadlocks(
				db.transaction(() =>
					Effect.gen(function* () {
						for (const organizationId of [
							...locked,
						].sort())
							yield* db.execute(lockOrganization(organizationId));

						if (readScope) {
							const grown = [
								...(yield* readScope),
							].filter((organizationId) => !locked.has(organizationId));
							if (grown.length > 0)
								return yield* new ScopeGrew({
									organizationIds: grown,
								});
						}

						const facts: RelationshipFact[] = [];
						const result = yield* body.pipe(
							Effect.provideService(RelationshipFacts, {
								record: (recorded) =>
									Effect.sync(() => {
										facts.push(...recorded);
									}),
							}),
						);
						const eventIds = yield* enqueueRelationshipMutations(
							projectRelationshipFacts(facts),
						);
						return {
							result,
							eventIds,
						};
					}),
				),
			);

		const attempt = (locked: ReadonlySet<OrganizationId>) =>
			write(locked).pipe(
				Effect.catchIf(
					(error) => error instanceof ScopeGrew,
					(grew) => Effect.succeed(grew),
				),
			);

		let locked = new Set(
			Effect.isEffect(organizationIds)
				? yield* organizationIds
				: organizationIds,
		);
		let written = yield* attempt(locked);
		while (written instanceof ScopeGrew) {
			locked = new Set([
				...locked,
				...written.organizationIds,
			]);
			written = yield* attempt(locked);
		}
		const { result, eventIds } = written;

		const { zedToken } = yield* authz.deliverRelationshipEvents(eventIds).pipe(
			Effect.catch((cause) =>
				Effect.logError(`authz.delivery_failed cause=${String(cause)}`).pipe(
					Effect.as({
						zedToken: undefined,
					}),
				),
			),
		);

		return {
			result,
			zedToken,
		};
	});
