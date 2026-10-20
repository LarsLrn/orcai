import { chatName, openChat, setUpChatModel } from "../../fixtures/chat/chat";
import {
	ask,
	createGenUiChat,
	turnFinished,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const TITLE = "Checklist without items";
const CLOSING = "The checklist could not be shown.";

test("gen-ui: a checklist call with invalid input fails in the work log", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(
		member,
		model,
		chatName("Checklist Failed"),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			toolCalls: [
				{
					name: "showChecklist",
					input: {
						title: TITLE,
					},
				},
			],
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Check my references");
	await turnFinished(page);

	const log = page.getByRole("log");
	await expect(log.getByText(CLOSING)).toBeVisible();
	await expect(log.getByText(TITLE)).toHaveCount(0);
	// The work log folds once the turn ends; its header counts the failure.
	await log
		.getByRole("button", {
			name: /1 failed/,
		})
		.click();
	await expect(
		log.getByText(message("chat_work_log_tool_show_checklist_name"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		log.getByText(message("chat_work_log_tool_status_failed"), {
			exact: true,
		}),
	).toBeVisible();
});
