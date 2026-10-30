import { describe, expect, test } from "bun:test";
import { aiChatInputSchema, continueChatInputSchema } from "../src";

const chat = {
	chatId: "0d8c6f5e-7b1a-4c2e-9f3d-2a1b0c9d8e7f",
	message: {
		id: "6b0e2d4a-3c1f-4e8b-9a7d-5f2c1b0a9e8d",
		role: "user",
		parts: [
			{
				type: "text",
				text: "Hello",
			},
		],
	},
};

describe("timeZone", () => {
	test("keeps the browser's time zone", () => {
		expect(
			aiChatInputSchema.parse({
				...chat,
				timeZone: "Europe/Berlin",
			}).timeZone,
		).toBe("Europe/Berlin");
	});

	test("drops a time zone it cannot use instead of failing the send", () => {
		expect(
			aiChatInputSchema.parse({
				...chat,
				timeZone: "x".repeat(200),
			}).timeZone,
		).toBeUndefined();
		expect(
			continueChatInputSchema.parse({
				chatId: chat.chatId,
				messageId: chat.message.id,
				approvals: [],
				timeZone: 42,
			}).timeZone,
		).toBeUndefined();
	});
});
