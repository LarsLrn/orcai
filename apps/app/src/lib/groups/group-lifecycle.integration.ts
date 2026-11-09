import { describe, expect, test } from "bun:test";
import type { BlockId, GroupId, OrganizationId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { grantResourceAccess } from "@/lib/access/resource-access";
import { readableNow } from "@/lib/authz/content-access";
import {
	addGroupMembers,
	createGroup,
	deleteGroups,
	removeGroupMembers,
} from "@/lib/groups/group-lifecycle";
import { deleteOrganizationsWithAuthorization } from "@/lib/organizations/organization-lifecycle";
import { removeMembers } from "@/lib/organizations/organization-membership";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, createBlock, outboxDelivered, readTuples } =
	appIntegration();

/** A member of a custom group that holds a viewer grant on the owner's private block. */
const groupWithGrant = async () => {
	const {
		organizationId,
		actors: [owner, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const { blockId, zedToken: created } = await createBlock(owner, zedToken);
	const group = await run(
		createGroup({
			organizationId,
			name: "Lifecycle group",
			description: null,
			actorId: owner.user.id,
		}),
	);
	await run(
		addGroupMembers({
			groupId: group.id,
			organizationId,
			userIds: [
				member.user.id,
			],
			actorId: owner.user.id,
		}),
	);
	await run(
		grantResourceAccess({
			resource: {
				resourceType: "block",
				resourceId: blockId,
			},
			organizationId,
			principals: [
				{
					principalType: "group",
					principalId: group.id,
				},
			],
			role: "viewer",
			actor: {
				userId: owner.user.id,
				zedToken: created,
			},
		}),
	);
	return {
		organizationId,
		owner,
		memberId: member.user.id,
		groupId: group.id,
		blockId,
	};
};

/** The group's active members and tuples, and whether the user reads the block in Postgres. */
const stateOf = async (params: {
	groupId: GroupId;
	blockId: BlockId;
	userId: UserId;
}) => {
	await outboxDelivered(params.groupId);
	const { members, readable } = await run(
		Effect.gen(function* () {
			const db = yield* DB;
			const members = yield* db
				.select({
					userId: dbSchema.groupMember.userId,
				})
				.from(dbSchema.groupMember)
				.where(
					and(
						eq(dbSchema.groupMember.groupId, params.groupId),
						isNull(dbSchema.groupMember.removedAt),
					),
				);
			const readable = yield* db
				.select({
					id: dbSchema.block.id,
				})
				.from(dbSchema.block)
				.where(
					and(
						eq(dbSchema.block.id, params.blockId),
						readableNow("block", dbSchema.block.id, params.userId),
					),
				);
			return {
				members: members.map((row) => row.userId),
				readable: readable.length > 0,
			};
		}),
	);
	return {
		members,
		readable,
		groupTuples: await readTuples({
			resourceType: "group",
			resourceId: params.groupId,
		}),
		grantTuples: await readTuples({
			resourceType: "block",
			resourceId: params.blockId,
			subjectId: params.groupId,
		}),
	};
};

const reached = (organizationId: OrganizationId, memberId: UserId) => ({
	members: [
		memberId,
	],
	readable: true,
	groupTuples: [
		`member@user:${memberId}`,
		`organization@organization:${organizationId}`,
	],
});

describe("group lifecycle", () => {
	test(
		"removing a member from the group ends their access through it in both stores",
		async () => {
			const { organizationId, memberId, groupId, blockId } =
				await groupWithGrant();
			expect(
				await stateOf({
					groupId,
					blockId,
					userId: memberId,
				}),
			).toMatchObject(reached(organizationId, memberId));

			await run(
				removeGroupMembers({
					groupId,
					organizationId,
					userIds: [
						memberId,
					],
				}),
			);
			expect(
				await stateOf({
					groupId,
					blockId,
					userId: memberId,
				}),
			).toMatchObject({
				members: [],
				readable: false,
				groupTuples: [
					`organization@organization:${organizationId}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"leaving the organisation ends the member's group memberships in both stores",
		async () => {
			const { organizationId, owner, memberId, groupId, blockId } =
				await groupWithGrant();
			await run(
				removeMembers({
					organizationId,
					userIds: [
						memberId,
					],
					actor: {
						kind: "member",
						userId: owner.user.id,
					},
				}),
			);
			expect(
				await stateOf({
					groupId,
					blockId,
					userId: memberId,
				}),
			).toMatchObject({
				members: [],
				readable: false,
				groupTuples: [
					`organization@organization:${organizationId}`,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting the group ends its memberships and grants in both stores",
		async () => {
			const { organizationId, memberId, groupId, blockId } =
				await groupWithGrant();
			await run(
				deleteGroups({
					organizationId,
					groupIds: [
						groupId,
					],
				}),
			);
			expect(
				await stateOf({
					groupId,
					blockId,
					userId: memberId,
				}),
			).toEqual({
				members: [],
				readable: false,
				groupTuples: [],
				grantTuples: [],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting the organisation deletes its groups' tuples",
		async () => {
			const { organizationId, memberId, groupId, blockId } =
				await groupWithGrant();
			await run(
				deleteOrganizationsWithAuthorization([
					organizationId,
				]),
			);
			expect(
				await stateOf({
					groupId,
					blockId,
					userId: memberId,
				}),
			).toEqual({
				members: [],
				readable: false,
				groupTuples: [],
				grantTuples: [],
			});
		},
		TIMEOUT,
	);
});
