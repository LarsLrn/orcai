import { describe, expect, test } from "bun:test";
import type { BlockId, BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization, reasonOf } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { turnSetup } from "@/lib/ai/turn/setup";
import { touchOrganizationRoles } from "@/lib/authz/organization-lifecycle";
import { grantResourceAccess } from "@/lib/authz/resource-access";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions, signIn, caller } =
	appIntegration();

/**
 * An author's bot with a behaviour and a repository in its home
 * organisation, a member there without a grant, and a second organisation
 * with an admin and a viewer.
 */
const botWithTwoOrganizations = async () => {
	const {
		organizationId: home,
		actors: [author, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const {
		organizationId: other,
		actors: [otherAdmin, viewer],
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	const { call, observe, token } = caller(zedToken);

	const createBlock = async (
		actor: Actor,
		type: "behaviour" | "repository",
	): Promise<BlockId> =>
		(
			await call(actor, (options) =>
				procedures.block.create(
					type === "behaviour"
						? {
								type,
								name: "Use behaviour",
								description: null,
								contentJson: null,
								status: "ready",
								config: {
									systemPrompt: "Answer from the handbook.",
								},
							}
						: {
								type,
								name: "Use repository",
								description: null,
								contentJson: null,
								status: "ready",
								assets: [],
								config: {
									minPassages: 1,
									maxPassages: 5,
									defaultPassages: 3,
								},
							},
					options,
				),
			)
		).data.id;

	const behaviour = await createBlock(author, "behaviour");
	const repository = await createBlock(author, "repository");
	const { data: bot } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Use bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				behaviourId: behaviour,
				repositoryIds: [
					repository,
				],
			},
			options,
		),
	);

	const createChat = (actor: Actor, botId: BotId) =>
		call(actor, (options) =>
			procedures.chat.create(
				{
					title: "Use chat",
					botId,
				},
				options,
			),
		);

	const canUse = async (actor: Actor) =>
		(
			await call(actor, (options) =>
				procedures.bot.find(
					{
						id: bot.id,
					},
					options,
				),
			)
		).data.capabilities;

	/** Scopes the bot to the second organisation, as adding from the Catalogue will. */
	const add = () =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.resourceScope).values({
					resourceType: "bot",
					resourceId: bot.id,
					organizationId: other,
					isPrimary: false,
					assignedBy: otherAdmin.user.id,
				});
			}),
		);

	const grantInOther = () =>
		run(
			grantResourceAccess({
				resource: {
					resourceType: "bot",
					resourceId: bot.id,
				},
				organizationId: other,
				principals: [
					{
						principalType: "user",
						principalId: viewer.user.id,
					},
				],
				role: "viewer",
				actor: {
					userId: otherAdmin.user.id,
					zedToken: token(),
				},
			}),
		).then(({ zedToken: written }) => observe(written));

	return {
		home,
		other,
		author,
		member,
		otherAdmin,
		viewer,
		procedures,
		call,
		createBlock,
		behaviour,
		repository,
		bot,
		createChat,
		canUse,
		add,
		grantInOther,
		token,
		observe,
	};
};

describe("using a resource in an organisation", () => {
	test(
		"a listed bot is previewed but needs a grant in the organisation to be used",
		async () => {
			const {
				author,
				member,
				viewer,
				procedures,
				call,
				bot,
				behaviour,
				repository,
				createChat,
				canUse,
			} = await botWithTwoOrganizations();
			await call(author, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: bot.id,
						visibility: "public",
						listBlockIds: [
							behaviour,
							repository,
						],
					},
					options,
				),
			);

			expect(await canUse(member)).toMatchObject({
				read: true,
				use: false,
			});
			expect(await reasonOf(createChat(member, bot.id))).toBe(
				"RESOURCE_NOT_USABLE_IN_ORGANIZATION",
			);
			expect(await reasonOf(createChat(viewer, bot.id))).toBe(
				"RESOURCE_NOT_USABLE_IN_ORGANIZATION",
			);

			await call(author, (options) =>
				procedures.resource.grant(
					{
						resourceType: "bot",
						resourceId: bot.id,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: member.user.id,
							},
						],
					},
					options,
				),
			);
			expect(await canUse(member)).toMatchObject({
				use: true,
			});
			expect(await reasonOf(createChat(member, bot.id))).toBeUndefined();
		},
		TIMEOUT,
	);

	test(
		"an added bot's blocks load in a turn without adding them",
		async () => {
			const {
				other,
				otherAdmin,
				viewer,
				procedures,
				call,
				repository,
				bot,
				createChat,
				canUse,
				add,
				grantInOther,
				token,
			} = await botWithTwoOrganizations();
			expect(await reasonOf(createChat(viewer, bot.id))).toBe(
				"RESOURCE_NOT_USABLE_IN_ORGANIZATION",
			);
			await add();
			await grantInOther();
			expect(await canUse(viewer)).toMatchObject({
				use: true,
			});

			const { data: provider } = await call(otherAdmin, (options) =>
				procedures.provider.create(
					{
						name: `Use ${crypto.randomUUID()}`,
						description: "Serves the added bot.",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			);
			const { data: model } = await call(otherAdmin, (options) =>
				procedures.model.create(
					{
						providerId: provider.id,
						providerModelId: `use-${crypto.randomUUID()}`,
						name: "Use model",
						description: "A chat model.",
						isDeprecated: false,
						capabilities: [
							"text",
							"tool-calling",
						],
					},
					options,
				),
			);
			const { data: chat } = await call(viewer, (options) =>
				procedures.chat.create(
					{
						title: "Added chat",
						botId: bot.id,
						config: {
							modelId: model.id,
							providerId: provider.id,
						},
					},
					options,
				),
			);

			const setup = await run(
				Effect.gen(function* () {
					const [stored] = yield* (yield* DB)
						.select()
						.from(dbSchema.chat)
						.where(eq(dbSchema.chat.id, chat.id));
					return yield* turnSetup(stored, {
						organizationId: other,
						user: viewer.user,
						context: (yield* Effect.promise(() =>
							procedureOptions(viewer, token()),
						)).context,
					});
				}),
			);
			expect(
				setup.agent.kind === "chat" && {
					systemPrompt: setup.agent.systemPrompt,
					repositories: setup.agent.repositories.map((block) => block.id),
				},
			).toEqual({
				systemPrompt: "Answer from the handbook.",
				repositories: [
					repository,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"a bot links only blocks of its home organisation that its editor may use there",
		async () => {
			const {
				author,
				member,
				procedures,
				call,
				createBlock,
				behaviour,
				bot,
				observe,
			} = await botWithTwoOrganizations();
			const save = async (actor: Actor, repositoryIds: BlockId[]) =>
				reasonOf(
					call(actor, (options) =>
						procedures.bot.save(
							{
								id: bot.id,
								name: bot.name,
								description: bot.description,
								status: "draft",
								behaviourId: behaviour,
								repositoryIds,
							},
							options,
						),
					),
				);

			const { organization: elsewhere } = await run(
				createOrganization({
					members: [
						{
							userId: author.user.id,
							role: "admin",
						},
					],
				}),
			);
			const { zedToken: touched } = await run(
				touchOrganizationRoles({
					userId: author.user.id,
					organizationIds: [
						elsewhere.id as OrganizationId,
					],
				}),
			);
			observe(touched);
			const authorElsewhere = await signIn(
				elsewhere.id as OrganizationId,
				author.user.id,
			);
			const foreign = await createBlock(authorElsewhere, "repository");
			expect(
				await save(author, [
					foreign,
				]),
			).toBe("BLOCK_LINK_FORBIDDEN");

			const listed = await createBlock(member, "repository");
			await call(member, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "block",
						resourceId: listed,
						visibility: "public",
					},
					options,
				),
			);
			expect(
				await save(author, [
					listed,
				]),
			).toBe("BLOCK_LINK_FORBIDDEN");

			const own = await createBlock(author, "repository");
			expect(
				await save(author, [
					own,
				]),
			).toBeUndefined();
		},
		TIMEOUT,
	);
});
