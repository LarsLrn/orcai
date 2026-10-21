import type { OrganizationId } from "@orcai/core";
import { DB } from "@orcai/db";
import { sql } from "drizzle-orm";
import * as Context from "effect/Context";
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
	sql`SELECT pg_advisory_xact_lock(${ORGANIZATION_LOCK_SPACE}, hashtext(${organizationId}))`;

/**
 * Runs `body` as the one transaction that changes rows and relationships
 * together. It first takes each organization's write lock, so writers in one
 * organization run one after another, then enqueues the tuple changes of the
 * facts `body` records before committing. After the commit it delivers them
 * and records the zedToken; a failed delivery is logged and left to the
 * outbox loop, so the write still succeeds.
 */
export const writeRelationships = <A, E, R>(
	scope: {
		organizationIds: Iterable<OrganizationId>;
	},
	body: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const { result, eventIds } = yield* db.transaction(() =>
			Effect.gen(function* () {
				for (const organizationId of [
					...new Set(scope.organizationIds),
				].sort())
					yield* db.execute(lockOrganization(organizationId));

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
		);

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
