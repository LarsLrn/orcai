import { describe, expect, test } from "bun:test";
import type { ChatId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { BotSetupFields } from "@orcai/schema";
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

/** An admin with a provider, two chat models and a bot of their own. */
const authorWithBot = async () => {
	const {
		organizationId,
		actors: [admin],
		zedToken,
	} = await organizationWith([
		"admin",
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
				name: `Effective ${crypto.randomUUID()}`,
				description: "Serves the effective model test.",
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
						providerModelId: `effective-${crypto.randomUUID()}`,
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
	const chatModel = await createModel("Chat model");
	const botModel = await createModel("Bot model");
	const { data: template } = await call((options) =>
		procedures.block.create(
			{
				type: "template",
				name: "Effective behaviour",
				description: null,
				contentJson: null,
				contentHtml: null,
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
				name: `Effective bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				templateBlockId: template.id,
			},
			options,
		),
	);

	const saveSetup = (setup: BotSetupFields | null) =>
		call((options) =>
			procedures.botSetup.save(
				{
					botId: bot.id,
					setup,
				},
				options,
			),
		);
	const createChat = async () =>
		(
			await call((options) =>
				procedures.chat.create(
					{
						title: "Effective chat",
						botId: bot.id,
						config: {
							modelId: chatModel.id,
							providerId: provider.id,
						},
					},
					options,
				),
			)
		).data;
	const effective = async (chatId: ChatId) =>
		(
			await call((options) =>
				procedures.chat.find(
					{
						id: chatId,
					},
					options,
				),
			)
		).data.effectiveModel;
	/** What the next turn would run with, read from the stored chat as the turn reads it. */
	const turn = async ({ id }: { id: ChatId }) =>
		run(
			Effect.gen(function* () {
				const [chat] = yield* (yield* DB)
					.select()
					.from(dbSchema.chat)
					.where(eq(dbSchema.chat.id, id));
				return yield* turnSetup(chat, {
					organizationId,
					user: admin.user,
					context: (yield* Effect.promise(() => procedureOptions(admin, token)))
						.context,
				});
			}),
		);

	return {
		admin,
		procedures,
		call,
		options: () => procedureOptions(admin, token),
		provider,
		chatModel,
		botModel,
		bot,
		createModel,
		saveSetup,
		createChat,
		effective,
		turn,
	};
};

describe("effective model", () => {
	test(
		"a required setup seeds new chats and decides every turn, live, until it is downgraded",
		async () => {
			const {
				procedures,
				options,
				chatModel,
				botModel,
				saveSetup,
				createChat,
				effective,
				turn,
			} = await authorWithBot();
			await saveSetup({
				modelId: botModel.id,
				strength: "required",
				generation: {
					temperature: 0.2,
				},
			});
			const chat = await createChat();
			expect(chat.config).toMatchObject({
				modelId: botModel.id,
				temperature: 0.2,
			});

			await saveSetup({
				modelId: botModel.id,
				strength: "required",
				generation: {
					temperature: 0.7,
				},
			});
			expect(await effective(chat.id)).toMatchObject({
				modelId: botModel.id,
				generation: {
					temperature: 0.7,
				},
				source: "bot-required",
			});
			const required = await turn(chat);
			expect(required.modelId).toBe(botModel.id);
			expect(required.callSettings.temperature).toBe(0.7);
			expect(
				await reasonOf(
					run(
						procedures.chat.update(
							{
								id: chat.id,
								config: {
									modelId: chatModel.id,
								},
							},
							await options(),
						),
					),
				),
			).toBe("CHAT_MODEL_REQUIRED_BY_BOT");

			await saveSetup({
				modelId: chatModel.id,
				strength: "recommended",
				generation: {},
			});
			const seeded = await turn(chat);
			expect(seeded.modelId).toBe(botModel.id);
			expect(seeded.callSettings.temperature).toBe(0.2);
			expect((await effective(chat.id)).source).toBe("chat");
		},
		TIMEOUT,
	);

	test(
		"a recommended setup seeds what the new chat does not choose, and the chat keeps a switch",
		async () => {
			const {
				procedures,
				options,
				provider,
				chatModel,
				botModel,
				saveSetup,
				createChat,
				effective,
			} = await authorWithBot();
			await saveSetup({
				modelId: botModel.id,
				strength: "recommended",
				generation: {
					topP: 0.5,
				},
			});
			const chat = await createChat();
			expect(chat.config).toMatchObject({
				modelId: chatModel.id,
				topP: 0.5,
			});

			await run(
				procedures.chat.update(
					{
						id: chat.id,
						config: {
							modelId: botModel.id,
							providerId: provider.id,
						},
					},
					await options(),
				),
			);
			await saveSetup({
				modelId: chatModel.id,
				strength: "recommended",
				generation: {
					topP: 0.9,
				},
			});
			expect(await effective(chat.id)).toMatchObject({
				modelId: botModel.id,
				generation: {
					topP: 0.5,
				},
				source: "chat",
			});
		},
		TIMEOUT,
	);

	test(
		"a required model that was deleted blocks the turn",
		async () => {
			const {
				procedures,
				options,
				createModel,
				saveSetup,
				createChat,
				effective,
				turn,
			} = await authorWithBot();
			const doomed = await createModel("Doomed model");
			await saveSetup({
				modelId: doomed.id,
				strength: "required",
				generation: {},
			});
			const chat = await createChat();

			await run(
				procedures.model.delete(
					{
						refs: [
							{
								id: doomed.id,
							},
						],
					},
					await options(),
				),
			);

			expect(await effective(chat.id)).toMatchObject({
				modelId: null,
				source: "bot-required",
				botSetup: {
					model: null,
					strength: "required",
				},
			});
			expect(await reasonOf(turn(chat))).toBe("BOT_MODEL_UNAVAILABLE");
		},
		TIMEOUT,
	);
});
