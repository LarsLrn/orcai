import { modelPickerDialog } from "../../fixtures/assistant/assistant";
import {
	chatName,
	chooseFromChatMenu,
	createChat,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { INFERENCE_MOCK_MODELS } from "../../fixtures/inference/server";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

test("the chat settings model picker hides deprecated models, which no turn accepts", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const admin = api.as("admin");
	const prefix = chatName("Picker");
	for (const [suffix, isDeprecated] of [
		[
			"Current",
			false,
		],
		[
			"Retired",
			true,
		],
	] as const) {
		await admin.model.create({
			providerId: model.providerId,
			providerModelId: `${prefix}-${suffix}`.toLowerCase().replaceAll(" ", "-"),
			name: `${prefix} ${suffix}`,
			description: "A further model on the mock for the picker spec.",
			isDeprecated,
			capabilities: [
				"text",
				"tool-calling",
			],
		});
	}
	const chatId = await createChat(
		api.as("member"),
		model,
		chatName("Model picker"),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await chooseFromChatMenu(page, "chat_actions_settings_action");
	await page
		.getByRole("dialog", {
			name: message("chat_settings_dialog_title"),
		})
		.getByRole("button", {
			name: INFERENCE_MOCK_MODELS.chat,
		})
		.click();
	await modelPickerDialog(page).getByRole("textbox").fill(prefix);

	// The chat's own model stays listed as the selection.
	const option = (name: string) =>
		modelPickerDialog(page).getByRole("option", {
			name: new RegExp(name),
		});
	await expect(option(`${prefix} Current`)).toBeVisible();
	await expect(option(`${prefix} Retired`)).toHaveCount(0);
});

test("a chat keeps its deprecated model while other settings change", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Deprecated model"));
	await api.as("admin").model.update({
		id: model.modelId,
		isDeprecated: true,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await chooseFromChatMenu(page, "chat_actions_settings_action");
	const settings = page.getByRole("dialog", {
		name: message("chat_settings_dialog_title"),
	});
	await expect(
		settings.getByRole("button", {
			name: INFERENCE_MOCK_MODELS.chat,
		}),
	).toBeVisible();

	await settings
		.getByRole("button", {
			name: message("chat_settings_advanced_title"),
		})
		.click();
	await settings
		.getByRole("slider", {
			name: message("chat_settings_temperature_label"),
		})
		.focus();
	await page.keyboard.press("ArrowRight");
	await settings
		.getByRole("button", {
			name: message("chat_settings_save_button"),
		})
		.click();

	await expect
		.poll(
			async () =>
				(
					await member.chat.find({
						id: chatId,
					})
				).data.config,
		)
		.toMatchObject({
			modelId: model.modelId,
			temperature: 1.1,
		});
});
