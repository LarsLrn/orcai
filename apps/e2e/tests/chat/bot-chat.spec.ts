import { randomUUID } from "node:crypto";
import {
	chatName,
	setUpChatModel,
	streamedText,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";

test("a chat linked to a just-saved bot answers its first message", async ({
	api,
	inference,
}) => {
	const model = await setUpChatModel(api, inference);

	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: chatName("Behaviour"),
		status: "ready",
		config: {
			systemPrompt: "Created by the chat slice.",
		},
	});
	const bot = await member.bot.save({
		name: chatName("Bot"),
		description: "Created by the chat slice.",
		status: "draft",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	const chat = await member.chat.create({
		botId: bot.data.id,
		config: model,
	});

	const stream = await member.ai.chat({
		chatId: chat.data.id,
		message: {
			id: randomUUID(),
			role: "user",
			parts: [
				{
					type: "text",
					text: "Hello from the chat slice",
				},
			],
		},
	});

	expect(await streamedText(stream)).toContain(
		"Mock inference reply to: Hello from the chat slice",
	);
});
