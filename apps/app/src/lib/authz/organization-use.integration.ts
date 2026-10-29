import { describe, expect, test } from "bun:test";
import type { BlockId, BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { turnSetup } from "@/lib/ai/turn/setup";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { touchOrganizationRoles } from "@/lib/authz/organization-lifecycle";
import { grantResourceAccess } from "@/lib/authz/resource-access";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, signIn } = authzIntegration();

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

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
	let token = zedToken;
	const call = async <A>(
		actor: Actor,
		operation: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(operation(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const createBlock = async (
		actor: Actor,
		type: "template" | "database",
	): Promise<BlockId> =>
		(
			await call(actor, (options) =>
				procedures.block.create(
					type === "template"
						? {
								type,
								name: "Use behaviour",
								description: null,
								contentJson: null,
								contentHtml: null,
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
								contentHtml: null,
								status: "ready",
								assets: [],
								config: {
									minReferences: 1,
									maxReferences: 5,
									defaultReferences: 3,
								},
							},
					options,
				),
			)
		).data.id;

	const template = await createBlock(author, "template");
	const repository = await createBlock(author, "database");
	const { data: bot } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Use bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				templateBlockId: template,
				databaseBlockIds: [
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

	/** Scopes the bot to the second organisation, as an install will. */
	const install = () =>
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
					zedToken: token,
				},
			}),
		).then(({ zedToken: written }) => {
			token = written ?? token;
		});

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
		template,
		repository,
		bot,
		createChat,
		canUse,
		install,
		grantInOther,
		token: () => token,
		/** Reads later calls at least as fresh as a write made outside the procedures. */
		advance: (written: string | undefined) => {
			token = written ?? token;
		},
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
				template,
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
							template,
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
		"an installed bot's blocks load in a turn without installing them",
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
				install,
				grantInOther,
				token,
			} = await botWithTwoOrganizations();
			expect(await reasonOf(createChat(viewer, bot.id))).toBe(
				"RESOURCE_NOT_USABLE_IN_ORGANIZATION",
			);
			await install();
			await grantInOther();
			expect(await canUse(viewer)).toMatchObject({
				use: true,
			});

			const { data: provider } = await call(otherAdmin, (options) =>
				procedures.provider.create(
					{
						name: `Use ${crypto.randomUUID()}`,
						description: "Serves the installed bot.",
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
						title: "Installed chat",
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
					databaseBlocks: setup.agent.databaseBlocks.map((block) => block.id),
				},
			).toEqual({
				systemPrompt: "Answer from the handbook.",
				databaseBlocks: [
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
				template,
				bot,
				advance,
			} = await botWithTwoOrganizations();
			const save = async (actor: Actor, databaseBlockIds: BlockId[]) =>
				reasonOf(
					call(actor, (options) =>
						procedures.bot.save(
							{
								id: bot.id,
								name: bot.name,
								description: bot.description,
								status: "draft",
								templateBlockId: template,
								databaseBlockIds,
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
			advance(touched);
			const authorElsewhere = await signIn(
				elsewhere.id as OrganizationId,
				author.user.id,
			);
			const foreign = await createBlock(authorElsewhere, "database");
			expect(
				await save(author, [
					foreign,
				]),
			).toBe("BLOCK_LINK_FORBIDDEN");

			const listed = await createBlock(member, "database");
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

			const own = await createBlock(author, "database");
			expect(
				await save(author, [
					own,
				]),
			).toBeUndefined();
		},
		TIMEOUT,
	);
});
