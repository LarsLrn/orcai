import {
	setUpAssistantModel,
	startConversation,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import { ask } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";

test("assistant: a turn leaves sampling to the provider and caps the output", async ({
	api,
	inference,
	org,
}) => {
	await setUpAssistantModel(api, org, inference);
	inference.reset();
	const member = api.as("member");
	const chatId = await startConversation(member);
	inference.respondWith({
		text: "Provider defaults apply.",
	});

	expect(await ask(member, chatId, "Which defaults apply?")).toBe(
		"Provider defaults apply.",
	);

	const [request] = turnRequests(inference);
	for (const key of [
		"temperature",
		"top_p",
		"frequency_penalty",
		"presence_penalty",
	]) {
		expect(request).not.toHaveProperty(key);
	}
	expect(request?.max_tokens).toBe(16_384);
});
