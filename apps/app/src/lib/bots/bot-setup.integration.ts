import { describe, expect, test } from "bun:test";
import type { BotId, GroupId, ModelId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ModelCapability } from "@orcai/schema";
import { createOrganization } from "@orcai/testing";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, signIn } = authzIntegration();

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

/**
 * An organisation whose admin owns a bot shared with a custom group, All
 * Members and one user, with a provider and models to set it up with.
 */
const organizationWithBot = async () => {
	const {
		organizationId,
		actors: [admin, grouped, direct],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
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

	const [allMembers] = await run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.group)
				.values({
					organizationId,
					name: "All Members",
					kind: "system",
					systemKey: "all_members",
					createdBy: admin.user.id,
				})
				.returning();
		}),
	);
	const { data: course } = await call(admin, (options) =>
		procedures.group.create(
			{
				name: `Course ${crypto.randomUUID()}`,
			},
			options,
		),
	);
	await call(admin, (options) =>
		procedures.group.addMembers(
			{
				groupId: course.id,
				userIds: [
					grouped.user.id,
				],
			},
			options,
		),
	);

	const createProvider = async () =>
		(
			await call(admin, (options) =>
				procedures.provider.create(
					{
						name: `Setup ${crypto.randomUUID()}`,
						description: "Serves the setup test.",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			)
		).data;
	const createModel = async (
		providerId: ProviderId,
		{
			capabilities = [
				"text",
				"tool-calling",
			],
			maxOutputTokens = null,
		}: {
			capabilities?: ModelCapability[];
			maxOutputTokens?: number | null;
		} = {},
	) =>
		(
			await call(admin, (options) =>
				procedures.model.create(
					{
						providerId,
						providerModelId: `setup-${crypto.randomUUID()}`,
						name: "Setup model",
						description: "A chat model.",
						isDeprecated: false,
						capabilities,
						maxOutputTokens,
					},
					options,
				),
			)
		).data;
	const provider = await createProvider();
	const model = await createModel(provider.id);

	const { data: bot } = await call(admin, (options) =>
		procedures.bot.save(
			{
				name: `Setup bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
			},
			options,
		),
	);
	await call(admin, (options) =>
		procedures.resource.grant(
			{
				resourceType: "bot",
				resourceId: bot.id,
				role: "viewer",
				principals: [
					{
						principalType: "group",
						principalId: course.id,
					},
					{
						principalType: "group",
						principalId: allMembers.id as GroupId,
					},
					{
						principalType: "user",
						principalId: direct.user.id,
					},
				],
			},
			options,
		),
	);

	const createPool = async (params: {
		providerId: ProviderId;
		modelId?: ModelId;
		groupIds: GroupId[];
	}) =>
		(
			await call(admin, (options) =>
				procedures.quota.create(
					{
						name: `Setup pool ${crypto.randomUUID()}`,
						periodType: "monthly",
						budgetAmount: 1_000_000,
						...params,
					},
					options,
				),
			)
		).data;

	const coverage = async (botId: BotId, modelId: ModelId) =>
		Object.fromEntries(
			(
				await call(admin, (options) =>
					procedures.botSetup.coverage(
						{
							botId,
							modelId,
						},
						options,
					),
				)
			).data.principals.map(({ principal, covered }) => [
				principal.id,
				covered,
			]),
		);

	return {
		organizationId,
		admin,
		grouped,
		direct,
		procedures,
		call,
		allMembers: allMembers.id as GroupId,
		course: course.id,
		provider,
		model,
		bot,
		createProvider,
		createModel,
		createPool,
		coverage,
	};
};

describe("bot setup", () => {
	test(
		"the writer stores a model of the organisation and refuses foreign, unusable or overreaching ones",
		async () => {
			const { admin, procedures, call, bot, model, provider, createModel } =
				await organizationWithBot();
			const save = (
				setup: Parameters<typeof procedures.botSetup.save>[0]["setup"],
			) =>
				call(admin, (options) =>
					procedures.botSetup.save(
						{
							botId: bot.id,
							setup,
						},
						options,
					),
				);

			const foreign = await (async () => {
				const { organization, zedToken: foreignToken } = await run(
					createOrganization({
						members: [
							{
								userId: admin.user.id,
								role: "admin",
							},
						],
					}),
				);
				const elsewhere = await signIn(organization.id, admin.user.id);
				const { data: foreignProvider } = await run(
					procedures.provider.create(
						{
							name: `Foreign ${crypto.randomUUID()}`,
							description: "Another organisation's provider.",
							kind: "openai-compatible",
							endpoint: "http://127.0.0.1:9/v1",
							apiKey: "key",
							meteringMode: "tokens",
							enabled: true,
						},
						await procedureOptions(elsewhere, foreignToken),
					),
				);
				const { data: foreignModel } = await run(
					procedures.model.create(
						{
							providerId: foreignProvider.id,
							providerModelId: "foreign",
							name: "Foreign model",
							description: "",
							isDeprecated: false,
							capabilities: [
								"text",
								"tool-calling",
							],
						},
						await procedureOptions(elsewhere, foreignToken),
					),
				);
				return foreignModel.id;
			})();
			const textOnly = await createModel(provider.id, {
				capabilities: [
					"text",
				],
			});
			const bounded = await createModel(provider.id, {
				maxOutputTokens: 1000,
			});

			expect(
				await reasonOf(
					save({
						modelId: foreign,
						strength: "required",
						generation: {},
					}),
				),
			).toBe("MODEL_NOT_FOUND");
			expect(
				await reasonOf(
					save({
						modelId: textOnly.id,
						strength: "required",
						generation: {},
					}),
				),
			).toBe("MODEL_TOOLS_UNSUPPORTED");
			expect(
				await reasonOf(
					save({
						modelId: bounded.id,
						strength: "recommended",
						generation: {
							maxTokens: 2000,
						},
					}),
				),
			).toBe("CHAT_MAX_TOKENS_EXCEEDS_MODEL");

			const { data: saved } = await save({
				modelId: model.id,
				strength: "required",
				generation: {
					temperature: 0.2,
				},
			});
			expect(saved).toEqual({
				model: {
					id: model.id,
					name: model.name,
					providerId: provider.id,
					usable: true,
				},
				strength: "required",
				generation: {
					temperature: 0.2,
				},
			});
			expect((await save(null)).data).toBeNull();
			expect(
				(
					await call(admin, (options) =>
						procedures.botSetup.find(
							{
								botId: bot.id,
							},
							options,
						),
					)
				).data,
			).toEqual({
				setup: null,
				canEdit: true,
			});
		},
		TIMEOUT,
	);

	test(
		"coverage follows group, All Members and model-specific pools of enabled providers",
		async () => {
			const {
				admin,
				grouped,
				direct,
				procedures,
				call,
				allMembers,
				course,
				provider,
				model,
				bot,
				createModel,
				createPool,
				coverage,
			} = await organizationWithBot();
			const other = await createModel(provider.id);

			expect(await coverage(bot.id, model.id)).toEqual({
				[course]: false,
				[allMembers]: false,
				[direct.user.id]: false,
			});

			await createPool({
				providerId: provider.id,
				groupIds: [
					course,
				],
			});
			expect(await coverage(bot.id, model.id)).toEqual({
				[course]: true,
				[allMembers]: false,
				[direct.user.id]: false,
			});

			await createPool({
				providerId: provider.id,
				modelId: other.id,
				groupIds: [
					allMembers,
				],
			});
			expect(await coverage(bot.id, model.id)).toEqual({
				[course]: true,
				[allMembers]: false,
				[direct.user.id]: false,
			});
			expect(await coverage(bot.id, other.id)).toEqual({
				[course]: true,
				[allMembers]: true,
				[direct.user.id]: true,
			});

			// A user in a covered group is covered too.
			await call(admin, (options) =>
				procedures.resource.grant(
					{
						resourceType: "bot",
						resourceId: bot.id,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: grouped.user.id,
							},
						],
					},
					options,
				),
			);
			expect((await coverage(bot.id, model.id))[grouped.user.id]).toBe(true);

			await call(admin, (options) =>
				procedures.provider.update(
					{
						id: provider.id,
						enabled: false,
					},
					options,
				),
			);
			expect(await coverage(bot.id, other.id)).toEqual({
				[course]: false,
				[allMembers]: false,
				[direct.user.id]: false,
				[grouped.user.id]: false,
			});
		},
		TIMEOUT,
	);

	test(
		"readers see the setup but not who it covers",
		async () => {
			const { admin, direct, procedures, call, bot, model } =
				await organizationWithBot();
			await call(admin, (options) =>
				procedures.botSetup.save(
					{
						botId: bot.id,
						setup: {
							modelId: model.id,
							strength: "recommended",
							generation: {},
						},
					},
					options,
				),
			);

			const { data } = await call(direct, (options) =>
				procedures.botSetup.find(
					{
						botId: bot.id,
					},
					options,
				),
			);
			expect(data.canEdit).toBe(false);
			expect(data.setup?.model?.id).toBe(model.id);
			expect(
				await reasonOf(
					run(
						procedures.botSetup.coverage(
							{
								botId: bot.id,
								modelId: model.id,
							},
							await procedureOptions(direct),
						),
					),
				),
			).toBe("BOT_SETUP_FORBIDDEN");
		},
		TIMEOUT,
	);

	test(
		"the bot's editors set it up only in its home organisation",
		async () => {
			const { admin, procedures, call, bot, model } =
				await organizationWithBot();
			await call(admin, (options) =>
				procedures.botSetup.save(
					{
						botId: bot.id,
						setup: {
							modelId: model.id,
							strength: "required",
							generation: {},
						},
					},
					options,
				),
			);
			const { organization: other } = await run(
				createOrganization({
					members: [
						{
							userId: admin.user.id,
							role: "member",
						},
					],
				}),
			);
			const elsewhere = await signIn(other.id, admin.user.id);

			const { data } = await call(elsewhere, (options) =>
				procedures.botSetup.find(
					{
						botId: bot.id,
					},
					options,
				),
			);
			expect(data).toEqual({
				setup: null,
				canEdit: false,
			});
			for (const setup of [
				{
					modelId: model.id,
					strength: "required" as const,
					generation: {},
				},
				null,
			]) {
				expect(
					await reasonOf(
						call(elsewhere, (options) =>
							procedures.botSetup.save(
								{
									botId: bot.id,
									setup,
								},
								options,
							),
						),
					),
				).toBe("BOT_SETUP_FORBIDDEN");
			}
			expect(
				await reasonOf(
					call(elsewhere, (options) =>
						procedures.botSetup.coverage(
							{
								botId: bot.id,
								modelId: model.id,
							},
							options,
						),
					),
				),
			).toBe("BOT_SETUP_FORBIDDEN");
		},
		TIMEOUT,
	);
});
