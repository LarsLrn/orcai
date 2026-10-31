import { describe, expect, test } from "bun:test";
import type { BotId, ChatId, GroupId, ModelId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { turnSetup } from "@/lib/ai/turn/setup";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

/** An admin and a member, three chat models, and pools the test assigns per group. */
const organizationWithModels = async () => {
	const {
		organizationId,
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const call = async <A>(
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
		actor: Actor = admin,
	) => {
		const result = await run(operation(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const { data: provider } = await call((options) =>
		procedures.provider.create(
			{
				name: `Default ${crypto.randomUUID()}`,
				description: "Serves the default chat model test.",
				kind: "openai-compatible",
				endpoint: "http://127.0.0.1:9/v1",
				apiKey: "key",
				meteringMode: "tokens",
				enabled: true,
			},
			options,
		),
	);
	const createModel = async (name: string) =>
		(
			await call((options) =>
				procedures.model.create(
					{
						providerId: provider.id,
						providerModelId: `default-${crypto.randomUUID()}`,
						name,
						description: "A chat model.",
						isDeprecated: false,
						capabilities: [
							"text",
							"tool-calling",
						],
					},
					options,
				),
			)
		).data;
	const fallback = await createModel("Fallback model");
	const preferred = await createModel("Preferred model");
	// The newest model leads the list order.
	const newest = await createModel("Newest model");

	const group = async (members: Actor[]) => {
		const { data } = await call((options) =>
			procedures.group.create(
				{
					name: `Default ${crypto.randomUUID()}`,
				},
				options,
			),
		);
		await call((options) =>
			procedures.group.addMembers(
				{
					groupId: data.id,
					userIds: members.map(({ user }) => user.id),
				},
				options,
			),
		);
		return data.id;
	};
	const pool = (modelId: ModelId, groupId: GroupId) =>
		call((options) =>
			procedures.quota.create(
				{
					name: `Default ${crypto.randomUUID()}`,
					providerId: provider.id,
					modelId,
					periodType: "monthly",
					budgetAmount: 1_000_000,
					groupIds: [
						groupId,
					],
				},
				options,
			),
		);
	const setDefault = (defaultChatModelId: ModelId | null) =>
		call((options) =>
			procedures.organization.update(
				{
					id: organizationId,
					defaultChatModelId,
				},
				options,
			),
		);

	/** A bot of the admin, shared with the organisation, whose setup recommends `modelId`. */
	const botRecommending = async (modelId: ModelId) => {
		const { data: template } = await call((options) =>
			procedures.block.create(
				{
					type: "template",
					name: "Default behaviour",
					description: null,
					contentJson: null,
					status: "ready",
					config: {
						systemPrompt: "Be brief.",
					},
				},
				options,
			),
		);
		const { data: bot } = await call((options) =>
			procedures.bot.save(
				{
					name: `Default bot ${crypto.randomUUID()}`,
					description: "Integration bot",
					status: "draft",
					templateBlockId: template.id,
				},
				options,
			),
		);
		await call((options) =>
			procedures.botSetup.save(
				{
					botId: bot.id,
					setup: {
						modelId,
						strength: "recommended",
						generation: {
							temperature: 0.3,
						},
					},
				},
				options,
			),
		);
		return bot.id;
	};

	/** A chat of the actor without a model of its own. */
	const modelLessChat = async (actor: Actor) =>
		(
			await call(
				(options) =>
					procedures.chat.create(
						{
							title: "Default chat",
						},
						options,
					),
				actor,
			)
		).data;
	/** The model the actor's picker preselects. */
	const preselected = async (actor: Actor) =>
		(await call((options) => procedures.chat.defaultModel({}, options), actor))
			.data?.modelId;
	/** The model the next turn of the chat runs on. */
	const turnModel = async (
		actor: Actor,
		{
			id,
		}: {
			id: ChatId;
		},
	) =>
		(
			await run(
				Effect.gen(function* () {
					const [chat] = yield* (yield* DB)
						.select()
						.from(dbSchema.chat)
						.where(eq(dbSchema.chat.id, id));
					return yield* turnSetup(chat, {
						organizationId,
						user: actor.user,
						context: (yield* Effect.promise(() =>
							procedureOptions(actor, token),
						)).context,
					});
				}),
			)
		).modelId;

	return {
		organizationId,
		admin,
		member,
		procedures,
		call,
		fallback,
		preferred,
		newest,
		group,
		pool,
		botRecommending,
		setDefault,
		modelLessChat,
		preselected,
		turnModel,
	};
};

describe("default chat model", () => {
	test(
		"a chat without a model runs on the default the picker preselects, per member's pools",
		async () => {
			const org = await organizationWithModels();
			const everyone = await org.group([
				org.admin,
				org.member,
			]);
			const admins = await org.group([
				org.admin,
			]);
			await org.pool(org.fallback.id, everyone);
			await org.pool(org.preferred.id, admins);
			await org.setDefault(org.preferred.id);

			// The admin's pools cover the default, the member's only the fallback.
			for (const [actor, expected] of [
				[
					org.admin,
					org.preferred.id,
				],
				[
					org.member,
					org.fallback.id,
				],
			] as const) {
				const chat = await org.modelLessChat(actor);
				expect(await org.preselected(actor)).toBe(expected);
				expect(await org.turnModel(actor, chat)).toBe(expected);
			}

			// Without a default, the newest covered model leads.
			await org.setDefault(null);
			expect(await org.preselected(org.member)).toBe(org.fallback.id);
			await org.pool(org.newest.id, everyone);
			expect(await org.preselected(org.member)).toBe(org.newest.id);
		},
		TIMEOUT,
	);

	test(
		"the setting takes only a usable model of the organisation and clears with its model",
		async () => {
			const org = await organizationWithModels();
			const other = await organizationWithModels();

			expect(await reasonOf(org.setDefault(other.preferred.id))).toBe(
				"MODEL_NOT_FOUND",
			);

			await org.setDefault(org.preferred.id);
			await org.call((options) =>
				org.procedures.model.delete(
					{
						refs: [
							{
								id: org.preferred.id,
							},
						],
					},
					options,
				),
			);
			const { data: organization } = await org.call((options) =>
				org.procedures.organization.find(
					{
						id: org.organizationId,
					},
					options,
				),
			);
			expect(organization.defaultChatModelId).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"a bot chat created without a model starts on the recommendation only while the member can use it",
		async () => {
			const org = await organizationWithModels();
			const admins = await org.group([
				org.admin,
			]);
			await org.pool(org.fallback.id, admins);
			await org.pool(org.preferred.id, admins);
			await org.setDefault(org.preferred.id);
			const startedOn = async (botId: BotId) =>
				(
					await org.call((options) =>
						org.procedures.chat.create(
							{
								title: "Bot chat",
								botId,
							},
							options,
						),
					)
				).data;

			// Covered and usable, it seeds its model and settings.
			const covered = await startedOn(
				await org.botRecommending(org.fallback.id),
			);
			expect(covered.config).toMatchObject({
				modelId: org.fallback.id,
				temperature: 0.3,
			});
			expect(await org.turnModel(org.admin, covered)).toBe(org.fallback.id);

			// Uncovered, the default takes over without the recommendation's settings.
			const uncovered = await startedOn(
				await org.botRecommending(org.newest.id),
			);
			expect(uncovered.config?.modelId).toBe(org.preferred.id);
			expect(uncovered.config?.temperature).toBeUndefined();
			expect(await org.turnModel(org.admin, uncovered)).toBe(org.preferred.id);

			// Unusable, likewise.
			const deprecatedBot = await org.botRecommending(org.fallback.id);
			await org.call((options) =>
				org.procedures.model.update(
					{
						id: org.fallback.id,
						isDeprecated: true,
					},
					options,
				),
			);
			const unusable = await startedOn(deprecatedBot);
			expect(unusable.config?.modelId).toBe(org.preferred.id);
		},
		TIMEOUT,
	);
});
