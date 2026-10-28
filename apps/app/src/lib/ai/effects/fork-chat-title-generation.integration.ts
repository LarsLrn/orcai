import { afterAll, describe, expect, test } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";
import { agentModel } from "@orcai/ai";
import type { ChatId, ModelId, OrganizationId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { serve } from "bun";
import { eq, like } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { forkChatTitleGenerationIfNeeded } from "./fork-chat-title-generation";

const { run, organizationWith, procedureOptions } = authzIntegration();

/** An OpenAI-compatible endpoint that titles every request after its model. */
const inference = serve({
	port: 0,
	fetch: async (request) => {
		const { model } = (await request.json()) as {
			model: string;
		};
		return Response.json({
			id: "title",
			object: "chat.completion",
			created: 0,
			model,
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: `Title by ${model}`,
					},
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: 10,
				completion_tokens: 3,
				total_tokens: 13,
			},
		});
	},
});
afterAll(() => inference.stop(true));
const endpoint = `${inference.url.origin}/v1`;

const until = async <A>(read: () => Promise<A | undefined>, what: string) => {
	const deadline = Date.now() + 20_000;
	for (;;) {
		const value = await read();
		if (value !== undefined) return value;
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await sleep(50);
	}
};

/**
 * An organisation with two providers on the endpoint, one text model each,
 * and a pool per provider for every member.
 */
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
	const asAdmin = () => procedureOptions(admin, token);
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

	const providerWithModel = async (providerModelId: string) => {
		const { data: provider, meta } = await run(
			procedures.provider.create(
				{
					name: `Integration ${crypto.randomUUID()}`,
					description: "Titles after the requested model.",
					kind: "openai-compatible",
					endpoint,
					apiKey: "key",
					meteringMode: "tokens",
					enabled: true,
				},
				await asAdmin(),
			),
		);
		token = meta?.zedToken ?? token;
		const { data: model } = await run(
			procedures.model.create(
				{
					providerId: provider.id,
					providerModelId,
					name: providerModelId,
					description: "A text model on the title endpoint.",
					isDeprecated: false,
					capabilities: [
						"text",
					],
				},
				await asAdmin(),
			),
		);
		await run(
			procedures.quota.create(
				{
					name: `Integration ${crypto.randomUUID()}`,
					providerId: provider.id,
					periodType: "monthly",
					budgetAmount: 1_000_000,
					groupIds: [
						allMembers.id,
					],
				},
				await asAdmin(),
			),
		);
		return {
			providerId: provider.id,
			modelId: model.id,
			providerModelId,
		};
	};

	const chatModel = await providerWithModel("chat-model");
	const utilityModel = await providerWithModel("utility-model");

	return {
		organizationId,
		admin,
		asAdmin,
		member,
		chatModel,
		utilityModel,
		procedures,
	};
};

type Setup = Awaited<ReturnType<typeof organizationWithModels>>;

const setUtilityModel = async (setup: Setup, modelId: ModelId | null) =>
	run(
		setup.procedures.organization.update(
			{
				id: setup.organizationId,
				utilityModelId: modelId,
			},
			await setup.asAdmin(),
		),
	);

/** Titles a new chat of `member` on the chat model, and reads the title and what it was metered against. */
const titleNewChat = async ({
	organizationId,
	member,
	chatModel,
}: {
	organizationId: OrganizationId;
	member: Actor;
	chatModel: Setup["chatModel"];
}) => {
	const [chat] = await run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.insert(dbSchema.chat)
				.values({
					userId: member.user.id,
					config: chatModel,
				})
				.returning();
		}),
	);
	const chatId = chat.id as ChatId;
	await run(
		forkChatTitleGenerationIfNeeded({
			chatId,
			currentTitle: null,
			chatModel: {
				language: agentModel({
					kind: "openai-compatible",
					connection: {
						apiKey: "key",
						endpoint,
					},
					providerModelId: chatModel.providerModelId,
				}).language,
				kind: "openai-compatible",
				providerId: chatModel.providerId,
				modelId: chatModel.modelId,
			},
			organizationId,
			userId: member.user.id,
			userMessage: {
				id: crypto.randomUUID(),
				role: "user",
				parts: [
					{
						type: "text",
						text: "How fast are refunds paid?",
					},
				],
			},
		}),
	);

	const title = await until(
		() =>
			run(
				Effect.gen(function* () {
					const [row] = yield* (yield* DB)
						.select({
							title: dbSchema.chat.title,
						})
						.from(dbSchema.chat)
						.where(eq(dbSchema.chat.id, chatId));
					return row?.title ?? undefined;
				}),
			),
		`the title of chat ${chatId}`,
	);
	const metered = await until(
		() =>
			run(
				Effect.gen(function* () {
					const rows = yield* (yield* DB)
						.select({
							providerId: dbSchema.quotaUsageEvent.providerId,
							eventType: dbSchema.quotaUsageEvent.eventType,
						})
						.from(dbSchema.quotaUsageEvent)
						.where(
							like(dbSchema.quotaUsageEvent.appRequestId, `title:${chatId}:%`),
						);
					const finalized = rows.filter((row) => row.eventType === "finalized");
					return finalized.length > 0
						? finalized.map((row) => row.providerId)
						: undefined;
				}),
			),
		`the metering of chat ${chatId}`,
	);

	return {
		title,
		metered,
	};
};

const utilityModelIdOf = (organizationId: OrganizationId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					utilityModelId: dbSchema.organization.utilityModelId,
				})
				.from(dbSchema.organization)
				.where(eq(dbSchema.organization.id, organizationId));
			return row.utilityModelId;
		}),
	);

describe("chat titles", () => {
	test(
		"come from the utility model and are metered against its provider",
		async () => {
			const setup = await organizationWithModels();
			await setUtilityModel(setup, setup.utilityModel.modelId);

			expect(await titleNewChat(setup)).toEqual({
				title: "Title by utility-model",
				metered: [
					setup.utilityModel.providerId,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"come from the chat's model while no utility model is set",
		async () => {
			const setup = await organizationWithModels();

			expect(await titleNewChat(setup)).toEqual({
				title: "Title by chat-model",
				metered: [
					setup.chatModel.providerId,
				],
			});
		},
		TIMEOUT,
	);

	test(
		"come from the chat's model while the utility model is unusable",
		async () => {
			const setup = await organizationWithModels();
			await setUtilityModel(setup, setup.utilityModel.modelId);
			await run(
				setup.procedures.provider.update(
					{
						id: setup.utilityModel.providerId as ProviderId,
						enabled: false,
					},
					await setup.asAdmin(),
				),
			);

			expect(await titleNewChat(setup)).toEqual({
				title: "Title by chat-model",
				metered: [
					setup.chatModel.providerId,
				],
			});
		},
		TIMEOUT,
	);
});

test(
	"deleting the utility model clears the setting",
	async () => {
		const setup = await organizationWithModels();
		await setUtilityModel(setup, setup.utilityModel.modelId);
		expect(await utilityModelIdOf(setup.organizationId)).toBe(
			setup.utilityModel.modelId,
		);

		await run(
			setup.procedures.model.delete(
				{
					refs: [
						{
							id: setup.utilityModel.modelId,
						},
					],
				},
				await setup.asAdmin(),
			),
		);

		expect(await utilityModelIdOf(setup.organizationId)).toBeNull();
	},
	TIMEOUT,
);
