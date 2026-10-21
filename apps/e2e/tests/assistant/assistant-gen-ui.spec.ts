import {
	offeredToolsOf,
	openConversation,
	setUpAssistantModel,
	startTitledConversation,
	turnRequests,
} from "../../fixtures/assistant/assistant";
import { messageText, turnFinished } from "../../fixtures/chat/chat";
import { ask } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const TITLE = "Bot setup check";
const CLOSING = "Publish the bot once the repository is ready.";

test("assistant: a checklist renders in the assistant's answer", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpAssistantModel(api, org, inference);
	const chatId = await startTitledConversation(api.as("member"), inference);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openConversation(page, chatId);

	inference.script(
		{
			toolCalls: [
				{
					name: "showChecklist",
					input: {
						title: TITLE,
						items: [
							{
								label: "Behaviour block",
								status: "met",
								summary: "A ready template is linked.",
							},
							{
								label: "Repository",
								status: "not_met",
								summary: "The repository holds no assets.",
							},
						],
					},
				},
			],
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Is my bot ready to publish?");
	await turnFinished(page);

	expect(offeredToolsOf(turnRequests(inference)[0])).toContain("showChecklist");
	const log = page.getByRole("log");
	await expect(
		log.getByText(TITLE, {
			exact: true,
		}),
	).toBeVisible();
	await expect(messageText(page, CLOSING)).toBeVisible();
	for (const [status, label] of [
		[
			"gen_ui_status_met",
			"Behaviour block",
		],
		[
			"gen_ui_status_not_met",
			"Repository",
		],
	] as const) {
		await expect(
			log
				.getByRole("listitem")
				.filter({
					hasText: label,
				})
				.getByRole("img", {
					name: message(status),
					exact: true,
				}),
		).toBeVisible();
	}
});
