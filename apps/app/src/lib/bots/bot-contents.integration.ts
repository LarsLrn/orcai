import { describe, expect, test } from "bun:test";
import type { BlockId } from "@orcai/core";
import { defaultRepositoryConfig, type Repository } from "@orcai/schema";
import { rejection } from "@orcai/testing";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, caller, organizationWith } = appIntegration();

/** An organisation with an owner who makes blocks and bots, and a member without access. */
const library = async () => {
	const {
		actors: [owner, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	const { call } = caller(zedToken);
	const tag = crypto.randomUUID();

	const repository = async (
		name: string,
		status: "draft" | "ready",
		config: Repository["config"] = defaultRepositoryConfig,
	) =>
		(
			await call(owner, (options) =>
				procedures.block.create(
					{
						type: "repository",
						name: `${name} ${tag}`,
						description: null,
						contentJson: null,
						status,
						config,
					},
					options,
				),
			)
		).data.id;
	const behaviour = async () =>
		(
			await call(owner, (options) =>
				procedures.block.create(
					{
						type: "behaviour",
						name: `Behaviour ${tag}`,
						description: null,
						contentJson: {
							type: "doc",
						},
						status: "ready",
						config: {
							systemPrompt: "Answer briefly.",
						},
					},
					options,
				),
			)
		).data.id;
	const bot = async (behaviourId: BlockId, repositoryIds: BlockId[]) =>
		(
			await call(owner, (options) =>
				procedures.bot.save(
					{
						name: `Bot ${tag}`,
						description: "Integration bot",
						status: "draft",
						contentJson: {
							type: "doc",
						},
						behaviourId,
						repositoryIds,
					},
					options,
				),
			)
		).data.id;
	const contents = (actor: Actor, id: Awaited<ReturnType<typeof bot>>) =>
		call(actor, (options) =>
			procedures.bot.findContents(
				{
					id,
				},
				options,
			),
		);

	return {
		owner,
		member,
		procedures,
		call,
		tag,
		repository,
		behaviour,
		bot,
		contents,
	};
};

describe("a bot's contents", () => {
	test(
		"answer with the published behaviour and repositories and their settings, while lists carry only tile fields",
		async () => {
			const {
				owner,
				member,
				procedures,
				call,
				tag,
				repository,
				behaviour,
				bot,
				contents,
			} = await library();
			const behaviourId = await behaviour();
			const published = await repository("Published", "ready");
			const draft = await repository("Draft", "draft");
			const botId = await bot(behaviourId, [
				published,
				draft,
			]);

			const { data } = await contents(owner, botId);
			expect(data.behaviour).toMatchObject({
				id: behaviourId,
				config: {
					systemPrompt: "Answer briefly.",
				},
			});
			expect(data.repositories).toEqual([
				expect.objectContaining({
					id: published,
					config: defaultRepositoryConfig,
				}),
			]);
			expect(await rejection(contents(member, botId))).toMatchObject({
				_tag: "NotFoundError",
			});

			const [{ data: bots }, { data: blocks }] = await Promise.all([
				call(owner, (options) =>
					procedures.bot.list(
						{
							search: tag,
							filters: {
								status: "all",
							},
						},
						options,
					),
				),
				call(owner, (options) =>
					procedures.block.list(
						{
							filters: {
								botId,
								status: "all",
							},
						},
						options,
					),
				),
			]);
			expect(bots.map(({ id }) => id)).toEqual([
				botId,
			]);
			expect(bots[0]).not.toHaveProperty("contentJson");
			expect(blocks.map(({ id }) => id).sort()).toEqual(
				[
					behaviourId,
					published,
					draft,
				].sort(),
			);
			for (const block of blocks) {
				expect(block).not.toHaveProperty("contentJson");
				expect(block).not.toHaveProperty("config");
			}
		},
		TIMEOUT,
	);

	test(
		"answer with every published repository beyond a list page",
		async () => {
			const { owner, repository, behaviour, bot, contents } = await library();
			const behaviourId = await behaviour();
			const repositories: {
				id: BlockId;
				config: Repository["config"];
			}[] = [];
			for (let index = 0; index < 21; index++) {
				const config = {
					...defaultRepositoryConfig,
					maxPassages: 30,
					defaultPassages: index + 1,
				};
				repositories.push({
					id: await repository(`Repository ${index}`, "ready", config),
					config,
				});
			}
			const botId = await bot(
				behaviourId,
				repositories.map(({ id }) => id),
			);

			const { data } = await contents(owner, botId);
			expect(
				data.repositories
					.map(({ id, config }) => ({
						id,
						config,
					}))
					.sort((a, b) => a.id.localeCompare(b.id)),
			).toEqual(repositories.sort((a, b) => a.id.localeCompare(b.id)));
		},
		TIMEOUT,
	);
});
