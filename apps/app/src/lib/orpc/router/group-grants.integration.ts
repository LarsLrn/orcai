import { describe, expect, test } from "bun:test";
import type { BlockId, BotId, GroupId, UserId } from "@orcai/core";
import type { ResourceGrantRole } from "@orcai/schema";
import { rejection } from "@orcai/testing";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	outcomeOf,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, caller, organizationByRole, createAsset } = appIntegration();

type Principal =
	| {
			principalType: "group";
			principalId: GroupId;
	  }
	| {
			principalType: "user";
			principalId: UserId;
	  };

const group = (principalId: GroupId): Principal => ({
	principalType: "group",
	principalId,
});

const user = (principalId: UserId): Principal => ({
	principalType: "user",
	principalId,
});

const behaviour = (name: string) => ({
	type: "behaviour" as const,
	name,
	description: null,
	contentJson: null,
	status: "ready" as const,
	config: {
		systemPrompt: "",
	},
});

/**
 * An organisation with one signed-in member per role and an outsider member,
 * a group the admin made with the member and `alsoInGroup` in it, and the
 * procedures they call at the newest token.
 */
const organization = async (
	alsoInGroup: readonly ("viewer" | "outsider")[] = [],
) => {
	const {
		organizationId,
		as,
		others: [outsider],
		zedToken,
		allMembersGroupId,
	} = await organizationByRole([
		"member",
	]);
	if (!allMembersGroupId) throw new Error("No All Members group");
	const procedures = await run(Procedures);
	const { call, observe } = caller(zedToken);
	const actors = {
		...as,
		outsider,
	};

	const groupName = `Group ${crypto.randomUUID()}`;
	const { data: created } = await call(as.admin, (options) =>
		procedures.group.create(
			{
				name: groupName,
			},
			options,
		),
	);
	const addMembers = (members: readonly Actor[]) =>
		call(as.admin, (options) =>
			procedures.group.addMembers(
				{
					groupId: created.id,
					userIds: members.map((member) => member.user.id),
				},
				options,
			),
		);
	await addMembers([
		as.member,
		...alsoInGroup.map((name) => actors[name]),
	]);

	const createBehaviour = async (actor: Actor = as.member) =>
		(
			await call(actor, (options) =>
				procedures.block.create(
					behaviour(`Behaviour ${crypto.randomUUID()}`),
					options,
				),
			)
		).data.id;

	const grant = (
		blockId: BlockId,
		principals: readonly Principal[],
		role: ResourceGrantRole,
		actor: Actor = as.member,
	) =>
		call(actor, (options) =>
			procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: blockId,
					principals: [
						...principals,
					],
					role,
				},
				options,
			),
		);

	const revoke = (blockId: BlockId, principal: Principal) =>
		call(as.member, (options) =>
			procedures.resource.revoke(
				{
					resourceType: "block",
					resourceId: blockId,
					...principal,
				},
				options,
			),
		);

	const listGrants = async (blockId: BlockId) =>
		(
			await call(as.member, (options) =>
				procedures.resource.listGrants(
					{
						resourceType: "block",
						resourceId: blockId,
					},
					options,
				),
			)
		).data;

	/** The block's grants as `role@principalId`. */
	const grantsOf = async (blockId: BlockId) =>
		(await listGrants(blockId))
			.map((grant) => `${grant.role}@${grant.principalId}`)
			.sort();

	/** The id of the block the actor finds, or the tag of the error finding it fails with. */
	const find = async (actor: Actor, blockId: BlockId) => {
		const found = call(actor, (options) =>
			procedures.block.find(
				{
					id: blockId,
				},
				options,
			),
		);
		const outcome = await outcomeOf(found);
		return outcome === "allowed" ? (await found).data.id : outcome;
	};

	const listed = async (actor: Actor) =>
		(
			await call(actor, (options) =>
				procedures.block.list(
					{
						pageIndex: 0,
						pageSize: 100,
					},
					options,
				),
			)
		).data.map((block) => block.id);

	/** The principals on offer as `group:kind:id` or `user:id`. */
	const offered = async (
		actor: Actor,
		blockId: BlockId,
		filter: {
			principalType: "group" | "user";
			query?: string;
			excludeGranted?: boolean;
		},
	) =>
		(
			await call(actor, (options) =>
				procedures.resource.listPrincipals(
					{
						resourceType: "block",
						resourceId: blockId,
						pageSize: 100,
						...filter,
					},
					options,
				),
			)
		).data.map((principal) =>
			principal.type === "group"
				? `group:${principal.kind}:${principal.id}`
				: `user:${principal.id}`,
		);

	return {
		organizationId,
		procedures,
		call,
		observe,
		as: actors,
		groupId: created.id,
		groupName,
		allMembersGroupId,
		addMembers,
		createBehaviour,
		grant,
		revoke,
		listGrants,
		grantsOf,
		find,
		listed,
		offered,
	};
};

describe("group grants", () => {
	test(
		"a group grant opens a private block to the group's members for as long as they belong",
		async () => {
			const o = await organization([
				"viewer",
			]);
			const { as, procedures } = o;
			const blockId = await o.createBehaviour();
			expect(await o.find(as.viewer, blockId)).toBe("NotFoundError");

			const granted = await o.grant(
				blockId,
				[
					group(o.groupId),
				],
				"viewer",
			);
			expect(granted.data).toMatchObject([
				{
					principal: {
						type: "group",
					},
					origin: "direct:group",
				},
			]);
			expect(await o.find(as.viewer, blockId)).toBe(blockId);
			expect(await o.listed(as.viewer)).toContain(blockId);

			const rename = () =>
				o.call(as.viewer, (options) =>
					procedures.block.update(
						{
							...behaviour("Renamed by the viewer"),
							id: blockId,
						},
						options,
					),
				);
			expect(await outcomeOf(rename())).toBe("ForbiddenError");
			await o.grant(
				blockId,
				[
					group(o.groupId),
				],
				"editor",
			);
			expect((await rename()).data.name).toBe("Renamed by the viewer");

			await o.call(as.admin, (options) =>
				procedures.group.removeMembers(
					{
						groupId: o.groupId,
						userIds: [
							as.viewer.user.id,
						],
					},
					options,
				),
			);
			expect(await o.find(as.viewer, blockId)).toBe("NotFoundError");
		},
		TIMEOUT,
	);

	test(
		"revoking the group grant closes the block again",
		async () => {
			const o = await organization([
				"viewer",
			]);
			const blockId = await o.createBehaviour();
			await o.grant(
				blockId,
				[
					group(o.groupId),
				],
				"viewer",
			);
			expect(await o.find(o.as.viewer, blockId)).toBe(blockId);

			expect((await o.revoke(blockId, group(o.groupId))).success).toBe(true);
			expect(await o.find(o.as.viewer, blockId)).toBe("NotFoundError");
			expect(await o.listed(o.as.viewer)).not.toContain(blockId);
		},
		TIMEOUT,
	);

	test(
		"deleting a group revokes what it was granted",
		async () => {
			const o = await organization([
				"viewer",
			]);
			const blockId = await o.createBehaviour();
			await o.grant(
				blockId,
				[
					group(o.groupId),
				],
				"viewer",
			);
			expect(await o.find(o.as.viewer, blockId)).toBe(blockId);

			await o.call(o.as.admin, (options) =>
				o.procedures.group.delete(
					{
						refs: [
							{
								id: o.groupId,
							},
						],
					},
					options,
				),
			);
			expect(await o.find(o.as.viewer, blockId)).toBe("NotFoundError");
			expect(await o.grantsOf(blockId)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"a member is offered and may grant to the groups they belong to and All Members, each with its origin",
		async () => {
			const o = await organization();
			const { as } = o;
			const blockId = await o.createBehaviour();
			const groupsOffered = (actor: Actor, block: BlockId, query?: string) =>
				o.offered(actor, block, {
					principalType: "group",
					query,
				});

			expect(await groupsOffered(as.member, blockId, o.groupName)).toEqual([
				`group:custom:${o.groupId}`,
			]);
			expect(await o.grantsOf(blockId)).toEqual([]);

			await o.grant(
				blockId,
				[
					group(o.groupId),
				],
				"editor",
			);
			expect(await o.listGrants(blockId)).toMatchObject([
				{
					principalType: "group",
					principalId: o.groupId,
					role: "editor",
					origin: "direct:group",
					principal: {
						name: o.groupName,
					},
				},
			]);
			// Offering is not filtered by grants unless asked to.
			expect(await groupsOffered(as.member, blockId, o.groupName)).toEqual([
				`group:custom:${o.groupId}`,
			]);

			const outsiderBlock = await o.createBehaviour(as.outsider);
			expect(
				await groupsOffered(as.outsider, outsiderBlock, o.groupName),
			).toEqual([]);
			expect(await groupsOffered(as.outsider, outsiderBlock)).toEqual([
				`group:system:${o.allMembersGroupId}`,
			]);
			expect(
				await rejection(
					o.grant(
						outsiderBlock,
						[
							group(o.groupId),
						],
						"viewer",
						as.outsider,
					),
				),
			).toMatchObject({
				_tag: "BadRequestError",
				reason: "GRANT_PRINCIPALS_INVALID",
				params: {
					rejections: [
						{
							principalId: o.groupId,
							reason: "GROUP_NOT_JOINED",
						},
					],
				},
			});

			await o.addMembers([
				as.outsider,
			]);
			expect(
				(
					await o.grant(
						outsiderBlock,
						[
							group(o.groupId),
						],
						"viewer",
						as.outsider,
					)
				).data,
			).toMatchObject([
				{
					principal: {
						type: "group",
					},
				},
			]);

			await o.grant(
				blockId,
				[
					group(o.allMembersGroupId),
				],
				"viewer",
			);
			expect(
				(await o.listGrants(blockId)).find(
					(grant) => grant.principalId === o.allMembersGroupId,
				),
			).toMatchObject({
				origin: "direct:group:all_members",
			});
			expect(await o.find(as.viewer, blockId)).toBe(blockId);

			await o.revoke(blockId, group(o.groupId));
			expect(await o.grantsOf(blockId)).toEqual([
				`viewer@${o.allMembersGroupId}`,
			]);
		},
		TIMEOUT,
	);

	test(
		"the principal list can leave out whoever already holds a grant",
		async () => {
			const o = await organization();
			const blockId = await o.createBehaviour();
			const offered = (principalType: "group" | "user") =>
				o.offered(o.as.member, blockId, {
					principalType,
					excludeGranted: true,
				});

			expect(await offered("group")).toContain(`group:custom:${o.groupId}`);
			expect(await offered("user")).toContain(`user:${o.as.viewer.user.id}`);

			await o.grant(
				blockId,
				[
					group(o.groupId),
					user(o.as.viewer.user.id),
				],
				"viewer",
			);
			expect(await offered("group")).not.toContain(`group:custom:${o.groupId}`);
			expect(await offered("user")).not.toContain(
				`user:${o.as.viewer.user.id}`,
			);

			await o.revoke(blockId, group(o.groupId));
			expect(await offered("group")).toContain(`group:custom:${o.groupId}`);
		},
		TIMEOUT,
	);

	test(
		"a batch grant lands whole, or not at all",
		async () => {
			const o = await organization();
			const { as } = o;
			const blockId = await o.createBehaviour();

			const granted = await o.grant(
				blockId,
				[
					group(o.groupId),
					user(as.viewer.user.id),
				],
				"viewer",
			);
			expect(granted.data).toHaveLength(2);
			expect(granted.rowCount).toBe(2);
			expect(await o.grantsOf(blockId)).toEqual(
				[
					`viewer@${o.groupId}`,
					`viewer@${as.viewer.user.id}`,
				].sort(),
			);

			const stranger = crypto.randomUUID() as UserId;
			expect(
				await rejection(
					o.grant(
						blockId,
						[
							user(as.manager.user.id),
							user(stranger),
						],
						"editor",
					),
				),
			).toMatchObject({
				_tag: "BadRequestError",
				reason: "GRANT_PRINCIPALS_INVALID",
				params: {
					rejections: [
						{
							principalId: stranger,
							reason: "USER_NOT_IN_SCOPE",
						},
					],
				},
			});
			expect(await o.grantsOf(blockId)).toEqual(
				[
					`viewer@${o.groupId}`,
					`viewer@${as.viewer.user.id}`,
				].sort(),
			);
		},
		TIMEOUT,
	);

	test(
		"a batch that would demote the last manager writes nothing",
		async () => {
			const o = await organization();
			const { as } = o;
			const blockId = await o.createBehaviour();
			await o.grant(
				blockId,
				[
					user(as.manager.user.id),
				],
				"manager",
			);

			// Each principal passes the precheck; only the transaction sees that
			// the batch demotes the last manager.
			expect(
				await rejection(
					o.grant(
						blockId,
						[
							user(as.manager.user.id),
							user(as.viewer.user.id),
						],
						"viewer",
					),
				),
			).toMatchObject({
				_tag: "BadRequestError",
				reason: "LAST_MANAGER_REQUIRED",
			});
			expect(await o.grantsOf(blockId)).toEqual([
				`manager@${as.manager.user.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("inherited access", () => {
	/** A bot linking a behaviour and a repository that holds an asset, all the member's. */
	const inheritanceChain = async () => {
		const o = await organization();
		const { as, procedures, call } = o;
		const behaviourId = await o.createBehaviour();
		const { asset, zedToken } = await createAsset(as.member, o.organizationId);
		o.observe(zedToken);
		const { data: repository } = await call(as.member, (options) =>
			procedures.block.create(
				{
					type: "repository",
					name: `Repository ${crypto.randomUUID()}`,
					description: null,
					contentJson: null,
					status: "ready",
					assets: [
						asset.id,
					],
					config: {
						minPassages: 1,
						maxPassages: 5,
						defaultPassages: 3,
					},
				},
				options,
			),
		);
		const botName = `Bot ${crypto.randomUUID()}`;
		const { data: bot } = await call(as.member, (options) =>
			procedures.bot.save(
				{
					name: botName,
					description: "Integration bot",
					status: "draft",
					behaviourId,
					repositoryIds: [
						repository.id,
					],
				},
				options,
			),
		);
		const inherited = async (
			resource:
				| {
						resourceType: "block";
						resourceId: BlockId;
				  }
				| {
						resourceType: "asset";
						resourceId: typeof asset.id;
				  },
		) =>
			(
				await call(as.member, (options) =>
					procedures.resource.inheritedAccess(resource, options),
				)
			).data;
		return {
			...o,
			behaviourId,
			assetId: asset.id,
			botId: bot.id as BotId,
			botName,
			inherited,
		};
	};

	test(
		"a block reports the access it inherits from its bot, apart from its own grants",
		async () => {
			const chain = await inheritanceChain();
			const behaviour = {
				resourceType: "block" as const,
				resourceId: chain.behaviourId,
			};

			// The bot's creator owns it rather than holding a grant, so nobody counts yet.
			expect(await chain.inherited(behaviour)).toMatchObject({
				botCount: 1,
				groupCount: 0,
				userCount: 0,
			});

			await chain.call(chain.as.member, (options) =>
				chain.procedures.resource.grant(
					{
						resourceType: "bot",
						resourceId: chain.botId,
						principals: [
							group(chain.groupId),
						],
						role: "viewer",
					},
					options,
				),
			);

			expect(await chain.grantsOf(chain.behaviourId)).toEqual([]);
			const after = await chain.inherited(behaviour);
			expect(after).toMatchObject({
				botCount: 1,
				groupCount: 1,
				hiddenAncestorCount: 0,
				throughPublic: false,
			});
			expect(after.ancestors.map((ancestor) => ancestor.name)).toContain(
				chain.botName,
			);
		},
		TIMEOUT,
	);

	test(
		"an asset reports access inherited two hops up",
		async () => {
			const chain = await inheritanceChain();
			const inherited = await chain.inherited({
				resourceType: "asset",
				resourceId: chain.assetId,
			});

			// `asset.read` includes `block->read`, which includes `bot->read`.
			expect(inherited).toMatchObject({
				blockCount: 1,
				botCount: 1,
			});
			expect(
				inherited.ancestors.map((ancestor) => ancestor.resourceType).sort(),
			).toEqual([
				"block",
				"bot",
			]);
		},
		TIMEOUT,
	);
});
