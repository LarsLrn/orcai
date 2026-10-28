import { describe, expect, test } from "bun:test";
import type { GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ModelCapability } from "@orcai/schema";
import { createOrganization, createUser } from "@orcai/testing";
import { and, eq } from "drizzle-orm";
import type * as Effect from "effect/Effect";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { organizationReadiness } from "./readiness";

const { run, organizationWith, procedureOptions, signIn, instanceAdmin } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** An admin, a member and the All Members group, configured row by row. */
const organization = async () => {
	const {
		organizationId,
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const adminId = admin.user.id;
	const db = await run(DB);
	const insert = <A>(effect: Effect.Effect<A, unknown, never>) =>
		run(effect as Effect.Effect<A, never, never>);
	const group = async (
		memberIds: readonly UserId[],
		systemKey?: "all_members",
	) => {
		const [row] = await insert(
			db
				.insert(dbSchema.group)
				.values({
					organizationId,
					name: systemKey ? "All Members" : `Group ${crypto.randomUUID()}`,
					kind: systemKey ? "system" : "custom",
					systemKey,
					createdBy: adminId,
				})
				.returning(),
		);
		if (memberIds.length > 0) {
			await insert(
				db.insert(dbSchema.groupMember).values(
					memberIds.map((userId) => ({
						groupId: row.id,
						userId,
						addedBy: adminId,
					})),
				),
			);
		}
		return row.id as GroupId;
	};
	const allMembers = await group([], "all_members");

	return {
		organizationId: organizationId as OrganizationId,
		admin,
		member,
		zedToken,
		allMembers,
		group,
		provider: async (enabled = true) => {
			const [row] = await insert(
				db
					.insert(dbSchema.provider)
					.values({
						organizationId,
						name: `Readiness ${crypto.randomUUID()}`,
						kind: "openai-compatible",
						description: "",
						apiKeyEncrypted: "unused",
						enabled,
					})
					.returning(),
			);
			return row.id;
		},
		model: async (
			providerId: typeof dbSchema.provider.$inferSelect.id,
			options: {
				capabilities?: ModelCapability[];
				isDeprecated?: boolean;
			} = {},
		) => {
			const [row] = await insert(
				db
					.insert(dbSchema.model)
					.values({
						providerId,
						providerModelId: `model-${crypto.randomUUID()}`,
						name: "Readiness model",
						description: "",
						capabilities: options.capabilities ?? [
							"text",
							"tool-calling",
						],
						isDeprecated: options.isDeprecated ?? false,
					})
					.returning(),
			);
			return row.id;
		},
		pool: async (params: {
			providerId: typeof dbSchema.provider.$inferSelect.id;
			modelId?: typeof dbSchema.model.$inferSelect.id;
			groupIds: readonly GroupId[];
			isActive?: boolean;
			assignmentActive?: boolean;
		}) => {
			const [row] = await insert(
				db
					.insert(dbSchema.quotaPool)
					.values({
						organizationId,
						name: `Readiness ${crypto.randomUUID()}`,
						providerId: params.providerId,
						modelId: params.modelId,
						periodType: "monthly",
						budgetAmount: 1_000,
						isActive: params.isActive ?? true,
						createdByUserId: adminId,
					})
					.returning(),
			);
			await insert(
				db.insert(dbSchema.quotaPoolGroupAssignment).values(
					params.groupIds.map((groupId) => ({
						quotaPoolId: row.id,
						groupId,
						isActive: params.assignmentActive ?? true,
						createdByUserId: adminId,
					})),
				),
			);
		},
		deleteGroup: (groupId: GroupId) =>
			insert(
				db
					.update(dbSchema.group)
					.set({
						deletedAt: new Date(),
					})
					.where(eq(dbSchema.group.id, groupId)),
			),
		leaveGroup: (groupId: GroupId, userId: UserId) =>
			insert(
				db
					.update(dbSchema.groupMember)
					.set({
						removedAt: new Date(),
					})
					.where(
						and(
							eq(dbSchema.groupMember.groupId, groupId),
							eq(dbSchema.groupMember.userId, userId),
						),
					),
			),
		deleteModel: (modelId: typeof dbSchema.model.$inferSelect.id) =>
			insert(db.delete(dbSchema.model).where(eq(dbSchema.model.id, modelId))),
		assistant: (assistantModelId: typeof dbSchema.model.$inferSelect.id) =>
			insert(
				db
					.update(dbSchema.organization)
					.set({
						assistantModelId,
					})
					.where(eq(dbSchema.organization.id, organizationId)),
			),
		readiness: async () =>
			Object.fromEntries(
				(await run(organizationReadiness(organizationId))).checks.map(
					(check) => [
						check.id,
						check,
					],
				),
			),
	};
};

describe("organisation readiness", () => {
	test(
		"turns each required check green as the setup is completed",
		async () => {
			const org = await organization();
			const fresh = await org.readiness();
			expect(fresh.provider.status).toBe("failing");
			expect(fresh["chat-model"].status).toBe("failing");
			expect(fresh.members.status).toBe("ok");

			const providerId = await org.provider();
			expect((await org.readiness()).provider.status).toBe("ok");

			const modelId = await org.model(providerId);
			expect((await org.readiness())["chat-model"].status).toBe("ok");

			await org.pool({
				providerId,
				groupIds: [
					org.allMembers,
				],
			});
			await org.assistant(modelId);
			const ready = await org.readiness();
			expect(ready.pool.status).toBe("ok");
			expect(ready["assistant-model"].status).toBe("ok");
			expect(ready["assistant-pool"].status).toBe("ok");
			expect(ready.coverage).toMatchObject({
				status: "ok",
				params: {
					count: 0,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"counts members outside a group-only pool",
		async () => {
			const org = await organization();
			const providerId = await org.provider();
			await org.model(providerId);
			const staff = await org.group([
				org.admin.user.id,
			]);
			await org.pool({
				providerId,
				groupIds: [
					staff,
				],
			});
			const readiness = await org.readiness();
			expect(readiness.pool.status).toBe("ok");
			expect(readiness.coverage).toMatchObject({
				status: "warning",
				params: {
					count: 1,
				},
			});
		},
		TIMEOUT,
	);

	test(
		"does not count a disabled provider, a deprecated model or a pool for another model",
		async () => {
			const org = await organization();
			const disabled = await org.provider(false);
			await org.model(disabled);
			expect((await org.readiness())["chat-model"].status).toBe("failing");

			const providerId = await org.provider();
			const deprecated = await org.model(providerId, {
				isDeprecated: true,
			});
			const textOnly = await org.model(providerId, {
				capabilities: [
					"text",
				],
			});
			await org.assistant(deprecated);
			await org.pool({
				providerId,
				modelId: textOnly,
				groupIds: [
					org.allMembers,
				],
			});
			const readiness = await org.readiness();
			expect(readiness["chat-model"].status).toBe("failing");
			expect(readiness.pool.status).toBe("failing");
			expect(readiness["assistant-model"]).toMatchObject({
				status: "failing",
				reason: "ASSISTANT_MODEL_UNUSABLE",
			});
		},
		TIMEOUT,
	);

	test(
		"ignores deleted groups, inactive assignments and inactive pools",
		async () => {
			const org = await organization();
			const providerId = await org.provider();
			await org.model(providerId);
			const gone = await org.group([
				org.member.user.id,
			]);
			await org.deleteGroup(gone);
			await org.pool({
				providerId,
				groupIds: [
					gone,
				],
			});
			await org.pool({
				providerId,
				groupIds: [
					org.allMembers,
				],
				assignmentActive: false,
			});
			await org.pool({
				providerId,
				groupIds: [
					org.allMembers,
				],
				isActive: false,
			});
			const readiness = await org.readiness();
			expect(readiness.pool.status).toBe("failing");
			expect(readiness.coverage.params).toEqual({
				count: 2,
			});
		},
		TIMEOUT,
	);

	test(
		"stops covering a member who left the pool's group",
		async () => {
			const org = await organization();
			const providerId = await org.provider();
			await org.model(providerId);
			const staff = await org.group([
				org.admin.user.id,
				org.member.user.id,
			]);
			await org.pool({
				providerId,
				groupIds: [
					staff,
				],
			});
			expect((await org.readiness()).coverage.status).toBe("ok");

			await org.leaveGroup(staff, org.member.user.id);
			expect((await org.readiness()).coverage.params).toEqual({
				count: 1,
			});
		},
		TIMEOUT,
	);

	test(
		"reports a deleted assistant model as missing",
		async () => {
			const org = await organization();
			const providerId = await org.provider();
			const modelId = await org.model(providerId);
			await org.assistant(modelId);
			expect((await org.readiness())["assistant-model"].status).toBe("ok");

			await org.deleteModel(modelId);
			expect((await org.readiness())["assistant-model"]).toMatchObject({
				status: "failing",
				reason: "ASSISTANT_MODEL_MISSING",
			});
		},
		TIMEOUT,
	);

	test(
		"refuses an admin elsewhere, an instance admin and a demoted admin",
		async () => {
			const procedures = await run(Procedures);
			const readiness = async (
				actor: Awaited<ReturnType<typeof signIn>>,
				zedToken?: string,
			) =>
				rejection(
					run(
						procedures.readiness.organization(
							{},
							await procedureOptions(actor, zedToken),
						),
					),
				);

			// An admin of one organisation who is only a member of the active one.
			const user = await run(createUser());
			await run(
				createOrganization({
					members: [
						{
							userId: user.id,
							role: "admin",
						},
					],
				}),
			);
			const { organization: active, zedToken } = await run(
				createOrganization({
					members: [
						{
							userId: user.id,
							role: "member",
						},
					],
				}),
			);
			expect(
				await readiness(await signIn(active.id, user.id), zedToken),
			).toMatchObject({
				_tag: "ForbiddenError",
			});

			const {
				organizationId,
				actors: [admin, demoted],
				zedToken: created,
			} = await organizationWith([
				"admin",
				"admin",
			]);
			expect(
				await readiness(await instanceAdmin(organizationId), created),
			).toMatchObject({
				_tag: "ForbiddenError",
			});

			const { meta } = await run(
				procedures.organizationMember.update(
					{
						userId: demoted.user.id,
						role: "member",
					},
					await procedureOptions(admin, created),
				),
			);
			expect(await readiness(demoted, meta?.zedToken)).toMatchObject({
				_tag: "ForbiddenError",
			});
		},
		TIMEOUT,
	);

	test(
		"is for the organisation's admins only",
		async () => {
			const org = await organization();
			const procedures = await run(Procedures);
			const readiness = async (actor: typeof org.admin) =>
				run(
					procedures.readiness.organization(
						{},
						await procedureOptions(actor, org.zedToken),
					),
				);

			expect(await rejection(readiness(org.member))).toMatchObject({
				_tag: "ForbiddenError",
			});
			const { data } = await readiness(org.admin);
			expect(data.checks.map((check) => check.id)).toContain("provider");
		},
		TIMEOUT,
	);
});
