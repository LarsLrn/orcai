import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId, BotId } from "@orcai/core";
import type { PublicationStatus } from "@orcai/schema";
import { reasonOf } from "@orcai/testing";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const {
	run,
	caller,
	organizationWith,
	createAsset,
	queueBehindOrganizationLock,
} = appIntegration();

const behaviourFields = (status: PublicationStatus) => ({
	type: "behaviour" as const,
	name: `Readiness behaviour ${crypto.randomUUID()}`,
	description: null,
	contentJson: null,
	status,
	config: {
		systemPrompt: "Be brief.",
	},
});

const repositoryFields = (
	status: PublicationStatus,
	assets: readonly AssetId[],
) => ({
	type: "repository" as const,
	name: `Readiness repository ${crypto.randomUUID()}`,
	description: null,
	contentJson: null,
	status,
	assets: [
		...assets,
	],
	config: {
		minPassages: 1,
		maxPassages: 5,
		defaultPassages: 3,
	},
});

/**
 * Two members: `author` owns the blocks and shares them with `builder`, who
 * owns the bots.
 */
const workshop = async () => {
	const {
		organizationId,
		actors: [author, builder],
		zedToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	const procedures = await run(Procedures);
	const { call, observe } = caller(zedToken);

	const share = (blockId: BlockId) =>
		call(author, (options) =>
			procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: blockId,
					role: "viewer",
					principals: [
						{
							principalType: "user",
							principalId: builder.user.id,
						},
					],
				},
				options,
			),
		);
	const behaviour = async (status: PublicationStatus = "ready") => {
		const fields = behaviourFields(status);
		const { data } = await call(author, (options) =>
			procedures.block.create(fields, options),
		);
		await share(data.id);
		return {
			id: data.id,
			fields,
		};
	};
	const asset = async () => {
		const created = await createAsset(author, organizationId);
		observe(created.zedToken);
		return created.asset.id;
	};
	const repository = async (
		status: PublicationStatus = "ready",
		assets?: readonly AssetId[],
	) => {
		const fields = repositoryFields(
			status,
			assets ?? [
				await asset(),
			],
		);
		const { data } = await call(author, (options) =>
			procedures.block.create(fields, options),
		);
		await share(data.id);
		return {
			id: data.id,
			fields,
		};
	};
	const save = (
		status: PublicationStatus,
		blocks: {
			behaviourId?: BlockId;
			repositoryIds?: BlockId[];
			id?: BotId;
		},
	) =>
		call(builder, (options) =>
			procedures.bot.save(
				{
					name: `Readiness bot ${crypto.randomUUID()}`,
					description: "Integration bot",
					status,
					...blocks,
				},
				options,
			),
		).then(({ data }) => data.id);
	const publish = (id: BotId) =>
		call(builder, (options) =>
			procedures.bot.publish(
				{
					id,
				},
				options,
			),
		);
	const find = (id: BotId) =>
		call(builder, (options) =>
			procedures.bot.find(
				{
					id,
				},
				options,
			),
		).then(({ data }) => data);
	const updateBlock = (
		actor: Actor,
		id: BlockId,
		fields:
			| ReturnType<typeof behaviourFields>
			| ReturnType<typeof repositoryFields>,
	) =>
		call(actor, (options) =>
			procedures.block.update(
				{
					id,
					...fields,
				},
				options,
			),
		);

	return {
		organizationId,
		author,
		procedures,
		call,
		behaviour,
		repository,
		asset,
		save,
		publish,
		find,
		updateBlock,
	};
};

describe("bot readiness", () => {
	test.each([
		[
			"no behaviour",
			"BOT_BEHAVIOUR_BLOCK_REQUIRED",
		],
		[
			"a draft behaviour",
			"BOT_BEHAVIOUR_BLOCK_NOT_READY",
		],
		[
			"a draft repository",
			"BOT_REPOSITORY_NOT_READY",
		],
		[
			"an empty repository",
			"BOT_REPOSITORY_EMPTY",
		],
	] as const)(
		"saving a ready bot with %s is refused for the reason publishing gives",
		async (shape, reason) => {
			const shop = await workshop();
			const blocks = {
				"no behaviour": async () => ({}),
				"a draft behaviour": async () => ({
					behaviourId: (await shop.behaviour("draft")).id,
				}),
				"a draft repository": async () => ({
					behaviourId: (await shop.behaviour()).id,
					repositoryIds: [
						(await shop.repository("draft")).id,
					],
				}),
				"an empty repository": async () => ({
					behaviourId: (await shop.behaviour()).id,
					repositoryIds: [
						(await shop.repository("ready", [])).id,
					],
				}),
			}[shape];
			const links = await blocks();
			const draft = await shop.save("draft", links);

			expect(await reasonOf(shop.publish(draft))).toBe(reason);
			expect(
				await reasonOf(
					shop.save("ready", {
						...links,
						id: draft,
					}),
				),
			).toBe(reason);
			expect(await reasonOf(shop.save("ready", links))).toBe(reason);
			expect(await shop.find(draft)).toMatchObject({
				status: "draft",
				readiness: [
					{
						reason,
					},
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a bot that meets the rule saves and publishes as ready",
		async () => {
			const shop = await workshop();
			const links = {
				behaviourId: (await shop.behaviour()).id,
				repositoryIds: [
					(await shop.repository()).id,
				],
			};

			const saved = await shop.save("ready", links);
			const published = await shop.save("draft", links);
			await shop.publish(published);

			for (const id of [
				saved,
				published,
			])
				expect(await shop.find(id)).toMatchObject({
					status: "ready",
					readiness: [],
				});
		},
		TIMEOUT,
	);

	test(
		"unpublishing a behaviour moves another member's ready bot to draft, which says why",
		async () => {
			const shop = await workshop();
			const behaviour = await shop.behaviour();
			const bot = await shop.save("ready", {
				behaviourId: behaviour.id,
			});

			await shop.updateBlock(shop.author, behaviour.id, {
				...behaviour.fields,
				status: "draft",
			});

			expect(await shop.find(bot)).toMatchObject({
				status: "draft",
				readiness: [
					{
						reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
					},
				],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting a behaviour moves another member's ready bot to draft, which says why",
		async () => {
			const shop = await workshop();
			const behaviour = await shop.behaviour();
			const bot = await shop.save("ready", {
				behaviourId: behaviour.id,
			});

			await shop.call(shop.author, (options) =>
				shop.procedures.block.delete(
					{
						refs: [
							{
								id: behaviour.id,
							},
						],
					},
					options,
				),
			);

			expect(await shop.find(bot)).toMatchObject({
				status: "draft",
				readiness: [
					{
						reason: "BOT_BEHAVIOUR_BLOCK_REQUIRED",
					},
				],
			});
		},
		TIMEOUT,
	);

	test(
		"deleting a repository's last asset moves every ready bot using it to draft",
		async () => {
			const shop = await workshop();
			const asset = await shop.asset();
			const repository = await shop.repository("ready", [
				asset,
			]);
			const links = {
				behaviourId: (await shop.behaviour()).id,
				repositoryIds: [
					repository.id,
				],
			};
			const bots = [
				await shop.save("ready", links),
				await shop.save("ready", links),
			];

			await shop.call(shop.author, (options) =>
				shop.procedures.asset.delete(
					{
						refs: [
							{
								id: asset,
							},
						],
					},
					options,
				),
			);

			for (const bot of bots)
				expect(await shop.find(bot)).toMatchObject({
					status: "draft",
					readiness: [
						{
							reason: "BOT_REPOSITORY_EMPTY",
						},
					],
				});
		},
		TIMEOUT,
	);

	test(
		"deleting a repository keeps a bot that still meets the rule ready",
		async () => {
			const shop = await workshop();
			const repository = await shop.repository();
			const bot = await shop.save("ready", {
				behaviourId: (await shop.behaviour()).id,
				repositoryIds: [
					repository.id,
				],
			});

			await shop.call(shop.author, (options) =>
				shop.procedures.block.delete(
					{
						refs: [
							{
								id: repository.id,
							},
						],
					},
					options,
				),
			);

			expect(await shop.find(bot)).toMatchObject({
				status: "ready",
				readiness: [],
			});
		},
		TIMEOUT,
	);

	test.each([
		"save first",
		"unpublish first",
	] as const)(
		"a behaviour unpublish racing a ready save leaves a draft bot (%s)",
		async (order) => {
			const shop = await workshop();
			const behaviour = await shop.behaviour();
			const bot = await shop.save("draft", {
				behaviourId: behaviour.id,
			});
			let saveReason: string | undefined;
			const save = () =>
				reasonOf(
					shop.save("ready", {
						id: bot,
						behaviourId: behaviour.id,
					}),
				).then((reason) => {
					saveReason = reason;
				});
			const unpublish = () =>
				shop.updateBlock(shop.author, behaviour.id, {
					...behaviour.fields,
					status: "draft",
				});

			await (order === "save first"
				? queueBehindOrganizationLock(shop.organizationId, save, unpublish)
				: queueBehindOrganizationLock(shop.organizationId, unpublish, save));

			expect(saveReason).toBe(
				order === "save first" ? undefined : "BOT_BEHAVIOUR_BLOCK_NOT_READY",
			);
			expect(await shop.find(bot)).toMatchObject({
				status: "draft",
				readiness: [
					{
						reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
					},
				],
			});
		},
		TIMEOUT,
	);
});
