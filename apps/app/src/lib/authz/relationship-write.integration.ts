import { describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { BlockId, GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { ALL_MEMBERS_GROUP_SYSTEM_KEY } from "@orcai/schema";
import { SpiceDbService, type TupleMutation } from "@orcai/spice-db";
import { createUser } from "@orcai/testing";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as TestClock from "effect/testing/TestClock";
import {
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import {
	AuthzLive,
	AuthzService,
	enqueueRelationshipMutations,
} from "@/lib/effect/services/authz";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { AUTHZ } from "@/settings/constants";

const {
	run,
	organizationWith,
	createBlock,
	procedureOptions,
	outboxDelivered,
	readTuples,
	instanceAdmin,
} = authzIntegration();

const viewerTuple = (
	blockId: BlockId,
	subjectId: UserId,
	operation: "touch" | "delete" = "touch",
): TupleMutation => ({
	resourceType: "block",
	resourceId: blockId,
	relation: "viewer",
	subjectType: "user",
	subjectId,
	operation,
});

const outboxStates = (eventIds: readonly string[]) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const rows = yield* db
			.select({
				id: dbSchema.authzOutbox.id,
				status: dbSchema.authzOutbox.status,
				attempts: dbSchema.authzOutbox.attempts,
				retrying: sql<
					boolean | null
				>`${dbSchema.authzOutbox.nextAttemptAt} > now()`,
			})
			.from(dbSchema.authzOutbox)
			.where(
				inArray(dbSchema.authzOutbox.id, [
					...eventIds,
				]),
			);
		return eventIds.map((id) => {
			const row = rows.find((candidate) => candidate.id === id);
			return {
				status: row?.status,
				attempts: row?.attempts,
				retrying: row?.retrying,
			};
		});
	});

class RolledBack extends Data.TaggedError("RolledBack")<{
	readonly value: unknown;
}> {}

/** Runs `body` in a transaction that is rolled back, returning its value. */
const rolledBack = <A, E, R>(body: Effect.Effect<A, E, R>) =>
	Effect.gen(function* () {
		const db = yield* DB;
		return yield* db
			.transaction(() =>
				Effect.flatMap(body, (value) =>
					Effect.fail(
						new RolledBack({
							value,
						}),
					),
				),
			)
			.pipe(
				Effect.catch((error) =>
					error instanceof RolledBack
						? Effect.succeed(error.value as A)
						: Effect.fail(error),
				),
			);
	});

const allMembersGroupOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [group] = yield* db
				.select({
					id: dbSchema.group.id,
				})
				.from(dbSchema.group)
				.where(
					and(
						eq(dbSchema.group.organizationId, organizationId),
						eq(dbSchema.group.systemKey, ALL_MEMBERS_GROUP_SYSTEM_KEY),
					),
				);
			return group.id;
		}),
	);

describe("organization lifecycle", () => {
	test(
		"a created organization has its admin and an All Members group of every role, and deletion removes both",
		async () => {
			const procedures = await run(Procedures);
			const { organizationId: homeId } = await organizationWith([]);
			const admin = await instanceAdmin(homeId);
			const suffix = crypto.randomUUID();
			const { data: organization } = await run(
				procedures.organization.create(
					{
						name: `Lifecycle ${suffix}`,
						slug: `lifecycle-${suffix}`,
					},
					await procedureOptions(admin),
				),
			);
			const groupId = await allMembersGroupOf(organization.id);
			await outboxDelivered(organization.id);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organization.id,
				}),
			).toEqual([
				`admin@user:${admin.user.id}`,
			]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: groupId,
				}),
			).toEqual([
				`member@organization:${organization.id}#admin`,
				`member@organization:${organization.id}#manager`,
				`member@organization:${organization.id}#member`,
				`member@organization:${organization.id}#viewer`,
				`organization@organization:${organization.id}`,
			]);

			await run(
				procedures.organization.delete(
					{
						refs: [
							{
								id: organization.id,
							},
						],
					},
					await procedureOptions(admin),
				),
			);
			await outboxDelivered(organization.id);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organization.id,
				}),
			).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: groupId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"deleting an organization queued after a role change leaves no role in SpiceDB",
		async () => {
			const procedures = await run(Procedures);
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const deleter = await instanceAdmin(organizationId);
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						procedures.organizationMember.update(
							{
								userId: member.user.id,
								role: "viewer",
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						procedures.organization.delete(
							{
								refs: [
									{
										id: organizationId,
									},
								],
							},
							await procedureOptions(deleter, zedToken),
						),
					),
			);
			await outboxDelivered(organizationId);
			expect(
				await readTuples({
					resourceType: "organization",
					resourceId: organizationId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("group membership", () => {
	const groupMembers = (groupId: GroupId) =>
		run(
			Effect.gen(function* () {
				const db = yield* DB;
				return yield* db
					.select({
						userId: dbSchema.groupMember.userId,
					})
					.from(dbSchema.groupMember)
					.where(
						and(
							eq(dbSchema.groupMember.groupId, groupId),
							isNull(dbSchema.groupMember.removedAt),
						),
					);
			}),
		);

	test(
		"added and removed members are mirrored in SpiceDB",
		async () => {
			const procedures = await run(Procedures);
			const {
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				procedures.group.create(
					{
						name: "Integration group",
						description: null,
					},
					await procedureOptions(admin, zedToken),
				),
			);
			const membership = {
				groupId: group.id,
				userIds: [
					member.user.id,
				],
			};
			await run(
				procedures.group.addMembers(
					membership,
					await procedureOptions(admin, zedToken),
				),
			);
			await outboxDelivered(group.id);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
				}),
			).toEqual([
				`member@user:${member.user.id}`,
				`organization@organization:${group.organizationId}`,
			]);

			await run(
				procedures.group.removeMembers(
					membership,
					await procedureOptions(admin, zedToken),
				),
			);
			await outboxDelivered(group.id);
			expect(await groupMembers(group.id)).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
				}),
			).toEqual([
				`organization@organization:${group.organizationId}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"adding a member queued after their removal from the organization is rejected",
		async () => {
			const procedures = await run(Procedures);
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				procedures.group.create(
					{
						name: "Integration group",
						description: null,
					},
					await procedureOptions(admin, zedToken),
				),
			);
			let rejection: unknown;
			await queueBehindOrganizationLock(
				organizationId,
				async () =>
					run(
						procedures.organizationMember.delete(
							{
								refs: [
									{
										userId: member.user.id,
									},
								],
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						procedures.group.addMembers(
							{
								groupId: group.id,
								userIds: [
									member.user.id,
								],
							},
							await procedureOptions(admin, zedToken),
						),
					).catch((error: unknown) => {
						rejection = error;
					}),
			);
			expect(rejection).toMatchObject({
				reason: "GROUP_MEMBERS_INVALID",
			});
			await outboxDelivered(member.user.id);
			expect(await groupMembers(group.id)).toEqual([]);
			expect(
				await readTuples({
					resourceType: "group",
					resourceId: group.id,
					subjectId: member.user.id,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("ordered delivery", () => {
	test(
		"concurrent deliverers apply alternating events in seq order",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());

			await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const authz = yield* AuthzService;
					const eventIds = (yield* db.transaction(() =>
						Effect.forEach(
							[
								"touch",
								"delete",
								"touch",
								"delete",
								"touch",
							] as const,
							(operation) =>
								enqueueRelationshipMutations([
									viewerTuple(blockId, subject.id, operation),
								]),
						),
					)).flat();
					yield* Effect.all(
						[
							authz.deliverRelationshipEvents(eventIds),
							authz.deliverRelationshipEvents(eventIds),
						],
						{
							concurrency: "unbounded",
						},
					);
				}),
			);

			await outboxDelivered(subject.id);
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: subject.id,
				}),
			).toEqual([
				`viewer@user:${subject.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("failed delivery", () => {
	/**
	 * A SpiceDB whose writes about `subjectId` fail until `recover` is called:
	 * sent to a closed port, or naming a relation the schema lacks.
	 */
	const failingWritesAbout = (
		subjectId: UserId,
		failure: "unavailable" | "schema not applied",
	) => {
		const unreachable = v1.NewClient(
			"unreachable",
			"127.0.0.1:1",
			v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
		).promises;
		let failing = true;
		const spiceDb = Layer.effect(
			SpiceDbService,
			Effect.gen(function* () {
				const { spice } = yield* SpiceDbService;
				const writeRelationships = (request: v1.WriteRelationshipsRequest) => {
					if (
						!failing ||
						!request.updates.some(
							(update) =>
								update.relationship?.subject?.object?.objectId === subjectId,
						)
					)
						return spice.writeRelationships(request);
					if (failure === "unavailable")
						return unreachable.writeRelationships(request);
					return spice.writeRelationships({
						...request,
						updates: request.updates.map((update) => ({
							...update,
							relationship: update.relationship && {
								...update.relationship,
								relation: "not_yet_in_schema",
							},
						})),
					});
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
		return {
			authz: Layer.fresh(AuthzLive).pipe(Layer.provide(spiceDb)),
			recover: () => {
				failing = false;
			},
			close: () => {
				unreachable.close();
			},
		};
	};

	const capturedLogs = () => {
		const lines: {
			level: string;
			message: string;
		}[] = [];
		return {
			lines,
			layer: Logger.layer([
				Logger.make(({ logLevel, message }) => {
					lines.push({
						level: logLevel,
						message: [
							message,
						]
							.flat()
							.join(" "),
					});
				}),
			]),
		};
	};

	const retryNow = (eventId: string, attempts?: number) =>
		Effect.gen(function* () {
			const db = yield* DB;
			yield* db
				.update(dbSchema.authzOutbox)
				.set({
					nextAttemptAt: null,
					...(attempts === undefined
						? {}
						: {
								attempts,
							}),
				})
				.where(eq(dbSchema.authzOutbox.id, eventId));
		});

	// Every test runs in a rolled-back transaction, so no other test's delivery
	// waits behind its failing event.
	test.each([
		[
			"SpiceDB is unavailable",
			"unavailable",
			"UNAVAILABLE",
		],
		[
			"the SpiceDB schema lacks the relation",
			"schema not applied",
			"FAILED_PRECONDITION",
		],
	] as const)(
		"an event retries while %s, holds back newer ones, and is delivered in order once it succeeds",
		async (_, failure, code) => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());
			const spice = failingWritesAbout(subject.id, failure);
			const logs = capturedLogs();

			const states = await run(
				rolledBack(
					Effect.gen(function* () {
						const authz = yield* AuthzService;
						const eventIds = [
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, subject.id),
							])),
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, subject.id, "delete"),
							])),
						];
						yield* authz.deliverRelationshipEvents(eventIds);
						const first = yield* outboxStates(eventIds);
						yield* retryNow(eventIds[0], 100);
						yield* authz.deliverRelationshipEvents(eventIds);
						const later = yield* outboxStates(eventIds);
						spice.recover();
						yield* retryNow(eventIds[0]);
						yield* authz.deliverRelationshipEvents(eventIds);
						const recovered = yield* outboxStates(eventIds);
						return {
							first,
							later,
							recovered,
						};
					}),
				).pipe(Effect.provide(Layer.mergeAll(spice.authz, logs.layer))),
			).finally(spice.close);

			const pending = {
				status: "pending" as const,
				attempts: 0,
				retrying: null,
			};
			expect(states).toEqual({
				first: [
					{
						status: "failed",
						attempts: 1,
						retrying: true,
					},
					pending,
				],
				later: [
					{
						status: "failed",
						attempts: 101,
						retrying: true,
					},
					pending,
				],
				recovered: [
					{
						status: "processed",
						attempts: 102,
						retrying: null,
					},
					{
						status: "processed",
						attempts: 1,
						retrying: null,
					},
				],
			});
			// The touch was applied before the delete.
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: subject.id,
				}),
			).toEqual([]);
			const blocked = logs.lines.filter(({ message }) =>
				message.startsWith("authz.delivery_blocked"),
			);
			expect(blocked).toHaveLength(2);
			for (const line of blocked)
				expect(line).toMatchObject({
					level: "Warn",
					message: expect.stringContaining(` code=${code} `),
				});
		},
		TIMEOUT,
	);

	test(
		"an unreadable payload is dead-lettered at once and newer events are delivered",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());
			const logs = capturedLogs();

			const { eventIds, states } = await run(
				rolledBack(
					Effect.gen(function* () {
						const db = yield* DB;
						const authz = yield* AuthzService;
						const [unreadable] = yield* db
							.insert(dbSchema.authzOutbox)
							.values({
								eventType: "spice.write-relationships",
								payloadJson: {
									mutations: "not a list",
								},
							})
							.returning({
								id: dbSchema.authzOutbox.id,
							});
						const eventIds = [
							unreadable.id,
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, subject.id),
							])),
						];
						yield* authz.deliverRelationshipEvents(eventIds);
						return {
							eventIds,
							states: yield* outboxStates(eventIds),
						};
					}),
				).pipe(Effect.provide(logs.layer)),
			);

			expect(states).toEqual([
				{
					status: "dead_letter",
					attempts: 1,
					retrying: null,
				},
				{
					status: "processed",
					attempts: 1,
					retrying: null,
				},
			]);
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: blockId,
					subjectId: subject.id,
				}),
			).toEqual([
				`viewer@user:${subject.id}`,
			]);
			expect(logs.lines).toContainEqual({
				level: "Error",
				message: expect.stringContaining(
					`authz.dead_letter eventId=${eventIds[0]} `,
				),
			});
		},
		TIMEOUT,
	);

	test(
		"a blocked event logs at error level once it is older than five minutes",
		async () => {
			const subject = await run(createUser());
			const spice = failingWritesAbout(subject.id, "unavailable");
			const logs = capturedLogs();

			await run(
				rolledBack(
					Effect.gen(function* () {
						const authz = yield* AuthzService;
						const eventIds = yield* enqueueRelationshipMutations([
							viewerTuple(crypto.randomUUID() as BlockId, subject.id),
						]);
						yield* authz.deliverRelationshipEvents(eventIds);
						yield* retryNow(eventIds[0]);
						yield* Effect.gen(function* () {
							yield* TestClock.setTime(
								Date.now() + AUTHZ.outboxBlockedErrorAfterMs,
							);
							yield* authz.deliverRelationshipEvents(eventIds);
						}).pipe(Effect.provide(TestClock.layer()));
					}),
				).pipe(Effect.provide(Layer.mergeAll(spice.authz, logs.layer))),
			).finally(spice.close);

			expect(
				logs.lines
					.filter(({ message }) => message.startsWith("authz.delivery_blocked"))
					.map(({ level }) => level),
			).toEqual([
				"Warn",
				"Error",
			]);
		},
		TIMEOUT,
	);
});
