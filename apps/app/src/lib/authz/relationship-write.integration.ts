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
import { groupProcedures } from "@/lib/orpc/router/group";
import { organizationProcedures } from "@/lib/orpc/router/organization";
import { organizationMemberProcedures } from "@/lib/orpc/router/organization-member";

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
			const { organizationId: homeId } = await organizationWith([]);
			const admin = await instanceAdmin(homeId);
			const suffix = crypto.randomUUID();
			const { data: organization } = await run(
				organizationProcedures.create(
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
				organizationProcedures.delete(
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
						organizationMemberProcedures.update(
							{
								userId: member.user.id,
								role: "viewer",
							},
							await procedureOptions(admin, zedToken),
						),
					),
				async () =>
					run(
						organizationProcedures.delete(
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
			const {
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				groupProcedures.create(
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
				groupProcedures.addMembers(
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
				groupProcedures.removeMembers(
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
			const {
				organizationId,
				actors: [admin, member],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { data: group } = await run(
				groupProcedures.create(
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
						organizationMemberProcedures.delete(
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
						groupProcedures.addMembers(
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
	test(
		"an event SpiceDB rejects is dead-lettered at once and newer events are delivered",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const subject = await run(createUser());

			const states = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const authz = yield* AuthzService;
					const eventIds = (yield* db.transaction(() =>
						Effect.forEach(
							[
								{
									...viewerTuple(blockId, subject.id),
									relation: "not_a_relation",
								},
								{
									...viewerTuple(blockId, subject.id),
									relation: "bot",
								},
								viewerTuple(blockId, subject.id),
							] as TupleMutation[],
							(mutation) =>
								enqueueRelationshipMutations([
									mutation,
								]),
						),
					)).flat();
					yield* authz.deliverRelationshipEvents(eventIds);
					return yield* outboxStates(eventIds);
				}),
			);

			expect(states).toEqual([
				{
					status: "dead_letter",
					attempts: 1,
					retrying: null,
				},
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
		},
		TIMEOUT,
	);

	test(
		"an unavailable SpiceDB keeps an event retrying and holds back newer ones",
		async () => {
			const {
				actors: [owner],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const { blockId } = await createBlock(owner, zedToken);
			const [unlucky, waiting] = await Promise.all([
				run(createUser()),
				run(createUser()),
			]);
			const unreachable = v1.NewClient(
				"unreachable",
				"127.0.0.1:1",
				v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
			).promises;
			let available = false;
			// Writes about `unlucky` go to a closed port until SpiceDB is available.
			const SometimesUnavailable = Layer.effect(
				SpiceDbService,
				Effect.gen(function* () {
					const { spice } = yield* SpiceDbService;
					return {
						spice: new Proxy(spice, {
							get: (target, key) =>
								key === "writeRelationships"
									? (request: v1.WriteRelationshipsRequest) =>
											!available &&
											request.updates.some(
												(update) =>
													update.relationship?.subject?.object?.objectId ===
													unlucky.id,
											)
												? unreachable.writeRelationships(request)
												: target.writeRelationships(request)
									: Reflect.get(target, key),
						}),
					};
				}),
			);

			// Rolled back, so no other test's delivery waits behind the failing event.
			const states = await run(
				rolledBack(
					Effect.gen(function* () {
						const db = yield* DB;
						const authz = yield* AuthzService;
						const eventIds = [
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, unlucky.id),
							])),
							...(yield* enqueueRelationshipMutations([
								viewerTuple(blockId, waiting.id),
							])),
						];
						const retry = (attempts?: number) =>
							db
								.update(dbSchema.authzOutbox)
								.set({
									nextAttemptAt: null,
									...(attempts === undefined
										? {}
										: {
												attempts,
											}),
								})
								.where(eq(dbSchema.authzOutbox.id, eventIds[0]));

						yield* authz.deliverRelationshipEvents(eventIds);
						const first = yield* outboxStates(eventIds);
						yield* retry(100);
						yield* authz.deliverRelationshipEvents(eventIds);
						const later = yield* outboxStates(eventIds);
						available = true;
						yield* retry();
						yield* authz.deliverRelationshipEvents(eventIds);
						const recovered = yield* outboxStates(eventIds);
						return {
							first,
							later,
							recovered,
						};
					}),
				).pipe(
					Effect.provide(
						Layer.fresh(AuthzLive).pipe(Layer.provide(SometimesUnavailable)),
					),
				),
			).finally(() => {
				unreachable.close();
			});

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
		},
		TIMEOUT,
	);
});
