import { beforeEach, describe, expect, test } from "bun:test";
import { createProviderLanguageModel } from "@orcai/ai";
import type {
	ChatId,
	ModelId,
	ModelProviderKind,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import * as Effect from "effect/Effect";
import { scriptedFetch } from "@/lib/ai/agents/test-provider";
import { quota, withQuotaServices } from "@/lib/ai/metered-call/test-quota";
import { generateChatTitle } from "./fork-chat-title-generation";

beforeEach(() => {
	quota.reset();
});

/** The title the kind's model gives, and the request it was asked with. */
const titleRequest = async (
	providerKind: ModelProviderKind,
	modelId: string,
) => {
	const provider = scriptedFetch(providerKind);
	provider.script([
		{
			text: '"Refund deadlines"',
		},
	]);
	const model = createProviderLanguageModel(
		providerKind,
		{
			apiKey: "key",
			endpoint: "https://llm.test/v1",
			fetch: provider.fetch,
		},
		modelId,
	);

	const title = await Effect.runPromise(
		withQuotaServices(
			generateChatTitle({
				chatId: "chat-1" as ChatId,
				model: {
					language: model,
					kind: providerKind,
					providerId: "provider-1" as ProviderId,
					modelId: "model-1" as ModelId,
				},
				organizationId: "org-1" as OrganizationId,
				userId: "user-1" as UserId,
				userMessageId: "message-1",
				userMessageText: "How fast are refunds paid?",
			}),
		),
	);

	return {
		title,
		body: provider.bodies[0],
	};
};

describe("generateChatTitle", () => {
	test("asks Anthropic without thinking and with a small output cap", async () => {
		const { title, body } = await titleRequest(
			"anthropic",
			"claude-sonnet-4-5",
		);

		expect(title).toBe("Refund deadlines");
		expect(body).toMatchObject({
			thinking: {
				type: "disabled",
			},
			max_tokens: 256,
		});
	});

	test("leaves reasoning to an openai-compatible server, which may reject turning it off", async () => {
		const { title, body } = await titleRequest("openai-compatible", "model-1");

		expect(title).toBe("Refund deadlines");
		expect(body).not.toHaveProperty("reasoning_effort");
		expect(body).not.toHaveProperty("max_tokens");
	});
});
