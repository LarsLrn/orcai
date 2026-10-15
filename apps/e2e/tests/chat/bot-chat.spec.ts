import { untilAllowed } from "../../fixtures/authorization";
import {
	expect,
	INFERENCE_MOCK_MODELS,
	test,
} from "../../fixtures/inference/fixture";
import { runId } from "../../fixtures/organisation";

/** A name no other test uses, so a spec finds its own records. */
const chatName = (label: string) => `E2E Chat ${label} ${runId()}`;

/** The text an assistant stream carries, whatever else it streams. */
const streamedText = async (
	stream: AsyncIterator<unknown>,
): Promise<string> => {
	let text = "";

	for (let step = await stream.next(); !step.done; step = await stream.next()) {
		const chunk = step.value;

		if (
			chunk !== null &&
			typeof chunk === "object" &&
			"type" in chunk &&
			chunk.type === "text-delta" &&
			"delta" in chunk &&
			typeof chunk.delta === "string"
		) {
			text += chunk.delta;
		}
	}

	return text;
};

test("a chat linked to a just-saved bot answers its first message", async ({
	api,
	inference,
}) => {
	// The `org` fixture's admin joined through the sign-up hook, whose grant no
	// response announces. A refused create wrote nothing, so repeating is safe.
	const provider = await untilAllowed(() =>
		api.as("admin").provider.create({
			name: chatName("Provider"),
			description: "Mock OpenAI-compatible endpoint for the chat slice.",
			endpoint: inference.url,
			compatibility: "openai",
			meteringMode: "tokens",
			apiKey: "e2e-mock-key",
			enabled: true,
		}),
	);
	const providerId = provider.data.id;

	await api.as("admin").model.discover({
		providerId,
	});
	const models = await api.as("admin").model.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			providerId,
		},
	});
	const chatModel = models.data.find(
		(model) => model.providerModelId === INFERENCE_MOCK_MODELS.chat,
	);
	expect(chatModel).toBeDefined();
	if (!chatModel) throw new Error("Missing mock chat model");

	const groups = await api.as("admin").group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(group) => group.systemKey === "all_members",
	);
	expect(allMembers).toBeDefined();
	if (!allMembers) throw new Error("Missing All Members group");

	await api.as("admin").quota.create({
		name: chatName("Pool"),
		providerId,
		periodType: "monthly",
		budgetAmount: 1_000_000,
		groupIds: [
			allMembers.id,
		],
	});

	const member = api.as("member");
	const template = await member.block.create({
		type: "template",
		name: chatName("Template"),
		status: "ready",
		config: {
			systemPrompt: "Created by the chat slice.",
		},
	});
	const bot = await member.bot.save({
		name: chatName("Bot"),
		description: "Created by the chat slice.",
		status: "draft",
		templateBlockId: template.data.id,
		databaseBlockIds: [],
	});
	const chat = await member.chat.create({
		botId: bot.data.id,
		config: {
			providerId,
			modelId: chatModel.id,
		},
	});

	const stream = await member.ai.chat({
		chatId: chat.data.id,
		messages: [
			{
				id: `${chat.data.id}-first`,
				role: "user",
				parts: [
					{
						type: "text",
						text: "Hello from the chat slice",
					},
				],
			},
		],
	});

	expect(await streamedText(stream)).toContain(
		"Mock inference reply to: Hello from the chat slice",
	);
});
