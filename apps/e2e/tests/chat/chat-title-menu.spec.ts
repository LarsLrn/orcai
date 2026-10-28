import {
	chatName,
	chatTitleMenu,
	chooseFromChatMenu,
	createChat,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

test("chat: the title menu renames the chat, opens its settings and downloads it", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const title = chatName("Title Menu");
	const chatId = await createChat(member, model, title);
	const turn = {
		question: "What is the capital of France?",
		reply: "Paris is the capital of France.",
	};
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	await expect(chatTitleMenu(page)).toHaveText(title);
	await chatTitleMenu(page).click();
	await expect(page.getByRole("menuitem")).toHaveText([
		message("chat_actions_rename_action"),
		message("chat_actions_pin_action"),
		message("chat_actions_settings_action"),
		message("chat_actions_download_action"),
		message("chat_actions_tour_action"),
		message("chat_actions_delete_action"),
	]);
	await page.keyboard.press("Escape");

	await chooseFromChatMenu(page, "chat_actions_settings_action");
	const settings = page.getByRole("dialog", {
		name: message("chat_settings_dialog_title"),
	});
	await expect(settings).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(settings).toHaveCount(0);

	const [download] = await Promise.all([
		page.waitForEvent("download"),
		chooseFromChatMenu(page, "chat_actions_download_action"),
	]);
	const transcript = await download
		.createReadStream()
		.then((stream) => stream.toArray())
		.then((chunks) => Buffer.concat(chunks).toString("utf8"));
	expect(transcript).toContain(turn.question);
	expect(transcript).toContain(turn.reply);

	const renamed = chatName("Renamed");
	await chooseFromChatMenu(page, "chat_actions_rename_action");
	const rename = page.getByRole("dialog", {
		name: message("chat_rename_dialog_title"),
	});
	await rename.getByRole("textbox").fill(renamed);
	await rename
		.getByRole("button", {
			name: message("chat_rename_dialog_submit"),
		})
		.click();
	await expect(rename).toHaveCount(0);
	await expect(chatTitleMenu(page)).toHaveText(renamed);
});
