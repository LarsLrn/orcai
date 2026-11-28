import { expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { BlockId, UserId } from "@orcai/core";
import { DB, dbSchema, lockSpaces } from "@orcai/db";
import { SpiceDbService, type TupleMutation } from "@orcai/spice-db";
import { integrationRuntime } from "@orcai/testing";
import { inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
	AuthzLive,
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import { TIMEOUT } from "@/lib/testing/app-integration";

const subjectId = crypto.randomUUID() as UserId;

/** Every update about `subjectId` either instance sends to SpiceDB. */
const sent: string[] = [];

const recordingSpiceDb = Layer.effect(
	SpiceDbService,
	Effect.gen(function* () {
		const { spice } = yield* SpiceDbService;
		const writeRelationships = (request: v1.WriteRelationshipsRequest) => {
			for (const { relationship } of request.updates) {
				if (relationship?.subject?.object?.objectId === subjectId) {
					sent.push(relationship.resource?.objectId ?? "");
				}
			}
			return spice.writeRelationships(request);
		};
		return {
			spice: new Proxy(spice, {
				get: (target, key) =>
					key === "writeRelationships"
						? writeRelationships
						: Reflect.get(target, key),
			}),
		};
	}),
);

// Two app instances: each runtime has its own pool and SpiceDB client.
const instance = () =>
	integrationRuntime(
		Layer.fresh(AuthzLive).pipe(Layer.provide(recordingSpiceDb)),
	);
const instances = [
	instance(),
	instance(),
];
const [first, second] = instances;

const replay = AuthzService.use((authz) => authz.replayRelationshipOutbox());

const viewer = (blockId: BlockId): TupleMutation => ({
	resourceType: "block",
	resourceId: blockId,
	relation: "viewer",
	subjectType: "user",
	subjectId,
	operation: "touch",
});

const statuses = (eventIds: readonly string[]) =>
	first.runPromise(
		DB.use((db) =>
			db
				.select({
					status: dbSchema.authzOutbox.status,
				})
				.from(dbSchema.authzOutbox)
				.where(inArray(dbSchema.authzOutbox.id, eventIds)),
		).pipe(Effect.map((rows) => rows.map(({ status }) => status))),
	);

const viewedBlocks = () =>
	first.runPromise(
		SpiceDbService.use(({ spice }) =>
			Effect.promise(() =>
				spice.readRelationships(
					v1.ReadRelationshipsRequest.create({
						consistency: v1.Consistency.create({
							requirement: {
								oneofKind: "fullyConsistent",
								fullyConsistent: true,
							},
						}),
						relationshipFilter: v1.RelationshipFilter.create({
							resourceType: "block",
							optionalSubjectFilter: v1.SubjectFilter.create({
								subjectType: "user",
								optionalSubjectId: subjectId,
							}),
						}),
					}),
				),
			),
		).pipe(
			Effect.map((responses) =>
				responses.map(({ relationship }) => relationship?.resource?.objectId),
			),
		),
	);

test(
	"an instance holding the delivery lock keeps the other from sending",
	async () => {
		const blockIds = Array.from(
			{
				length: 5,
			},
			() => crypto.randomUUID() as BlockId,
		);

		// The first instance takes the delivery lock, as it does mid-delivery.
		const locked = Promise.withResolvers<void>();
		const release = Promise.withResolvers<void>();
		const holding = first.runPromise(
			DB.use((db) =>
				db.transaction(() =>
					Effect.gen(function* () {
						yield* db.execute(
							sql`SELECT pg_advisory_xact_lock(${lockSpaces.authzDelivery})`,
						);
						locked.resolve();
						yield* Effect.promise(() => release.promise);
					}),
				),
			),
		);
		await Promise.race([
			locked.promise,
			holding,
		]);

		let eventIds: string[];
		try {
			eventIds = (
				await second.runPromise(
					Effect.forEach(blockIds, (blockId) =>
						DB.use((db) =>
							db.transaction(() =>
								enqueueRelationshipMutations([
									viewer(blockId),
								]),
							),
						),
					),
				)
			).flat();
			await second.runPromise(replay);

			expect(sent).toEqual([]);
			expect(await statuses(eventIds)).toEqual(blockIds.map(() => "pending"));
		} finally {
			release.resolve();
			await holding;
		}

		// Both deliver at once. A delivery gives up after about 2 s of waiting on
		// the lock, which parallel files also take, so repeat until delivered.
		const deadline = Date.now() + 20_000;
		while (
			(await statuses(eventIds)).some((status) => status !== "processed")
		) {
			if (Date.now() > deadline) {
				throw new Error("Timed out delivering the outbox events");
			}
			await Promise.all(
				instances.map((runtime) =>
					runtime.runPromise(
						AuthzService.use((authz) =>
							authz.deliverRelationshipEvents(eventIds),
						),
					),
				),
			);
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		// At most once each: another test file may have delivered some of them.
		expect(new Set(sent).size).toBe(sent.length);
		expect((await viewedBlocks()).sort()).toEqual(
			[
				...blockIds,
			].sort(),
		);

		// Delivered events are never sent again. The replay runs inside a
		// transaction that already holds the lock, so it is sure to take it.
		const sentBefore = sent.length;
		await first.runPromise(
			DB.use((db) =>
				db.transaction(() =>
					db
						.execute(
							sql`SELECT pg_advisory_xact_lock(${lockSpaces.authzDelivery})`,
						)
						.pipe(Effect.andThen(replay)),
				),
			),
		);
		expect(sent).toHaveLength(sentBefore);
	},
	TIMEOUT,
);
