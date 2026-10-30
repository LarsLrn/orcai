import type { ModelId } from "@orcai/core";
import type { ApiClient } from "../../fixtures/api";
import { rejection } from "../../fixtures/authorization";
import {
	type ChatModel,
	completionRequests,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { createBot, createBotChat } from "../../fixtures/gen-ui/gen-ui";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const REQUIRED_MODEL = "e2e-mock-required";

/** A second chat model on the provider, which a bot can require. */
const createRequiredModel = async (
	admin: ApiClient,
	model: ChatModel,
): Promise<ModelId> => {
	const created = await admin.model.create({
		providerId: model.providerId,
		providerModelId: REQUIRED_MODEL,
		name: "E2E Required Model",
		description: "Required by the bot model slice.",
		isDeprecated: false,
		capabilities: [
			"text",
			"tool-calling",
		],
	});

	return created.data.id;
};

/** A member's bot that requires `modelId`, and a chat with it started on the default model. */
const requiringBot = async (
	member: ApiClient,
	model: ChatModel,
	modelId: ModelId,
) => {
	const bot = await createBot(member, {});
	await member.botSetup.save({
		botId: bot.id,
		setup: {
			modelId,
			strength: "required",
			generation: {},
		},
	});
	const chatId = await createBotChat(member, model, bot.id);

	return {
		bot,
		chatId,
	};
};

test("bots: a required model locks the picker and every turn uses it", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const required = await createRequiredModel(api.as("admin"), model);
	const member = api.as("member");
	const { bot, chatId } = await requiringBot(member, model, required);

	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Which model answers?",
			reply: "The required one.",
		},
	});
	const body = completionRequests(inference).at(-1)?.body as
		| {
				model?: string;
		  }
		| undefined;
	expect(body?.model).toBe(REQUIRED_MODEL);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	const locked = page.getByText("E2E Required Model", {
		exact: true,
	});
	await expect(locked).toBeVisible();
	await locked.hover();
	await expect(
		page.getByText(
			message("chat_model_locked_tooltip", {
				bot: bot.name,
			}),
		),
	).toBeVisible();
});

test("bots: the Model step shows who the bot's quota covers", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const bot = await createBot(member, {});
	const groups = await member.group.list({
		pageIndex: 0,
		pageSize: 100,
	});
	const allMembers = groups.data.find(
		(group) => group.systemKey === "all_members",
	);
	if (!allMembers) throw new Error("Missing All Members group");
	await member.resource.grant({
		resourceType: "bot",
		resourceId: bot.id,
		role: "viewer",
		principals: [
			{
				principalType: "group",
				principalId: allMembers.id,
			},
		],
	});
	await member.botSetup.save({
		botId: bot.id,
		setup: {
			modelId: model.modelId,
			strength: "recommended",
			generation: {},
		},
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}/setup?step=4`);
	await expect(
		page.getByRole("heading", {
			name: message("bot_setup_coverage_title"),
		}),
	).toBeVisible();
	await expect(
		page.getByText(
			message("bot_setup_coverage_count", {
				covered: 1,
				total: 1,
			}),
		),
	).toBeVisible();
	await expect(
		page.getByRole("listitem").filter({
			hasText: allMembers.name,
		}),
	).toContainText(message("bot_setup_coverage_covered"));
});

test("bots: moving on from the Model step saves its changes", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const bot = await createBot(member, {});
	await member.botSetup.save({
		botId: bot.id,
		setup: {
			modelId: model.modelId,
			strength: "recommended",
			generation: {},
		},
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}/setup?step=4`);
	await page
		.getByRole("combobox", {
			name: message("bot_setup_strength_label"),
		})
		.click();
	await page
		.getByRole("option", {
			name: message("bot_setup_strength_required_label"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();

	await expect(page).toHaveURL(/step=5/);
	await expect
		.poll(
			async () =>
				(
					await member.botSetup.find({
						botId: bot.id,
					})
				).data.setup?.strength,
		)
		.toBe("required");
});

test("bots: a setup on a deprecated model still saves its other settings, but cannot switch to one", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const admin = api.as("admin");
	const member = api.as("member");
	const bot = await createBot(member, {});
	await member.botSetup.save({
		botId: bot.id,
		setup: {
			modelId: model.modelId,
			strength: "recommended",
			generation: {},
		},
	});
	await admin.model.update({
		id: model.modelId,
		isDeprecated: true,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}/setup?step=4`);
	await page
		.getByRole("combobox", {
			name: message("bot_setup_strength_label"),
		})
		.click();
	await page
		.getByRole("option", {
			name: message("bot_setup_strength_required_label"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();

	await expect(page).toHaveURL(/step=5/);
	await expect
		.poll(
			async () =>
				(
					await member.botSetup.find({
						botId: bot.id,
					})
				).data.setup,
		)
		.toMatchObject({
			model: {
				id: model.modelId,
				usable: false,
			},
			strength: "required",
		});

	const other = await createBot(member, {});
	const refused = await rejection(
		member.botSetup.save({
			botId: other.id,
			setup: {
				modelId: model.modelId,
				strength: "recommended",
				generation: {},
			},
		}),
	);
	expect(refused.data).toMatchObject({
		reason: "MODEL_DEPRECATED",
	});
});

test("bots: a required model whose provider is disabled blocks the bot's chats", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const admin = api.as("admin");
	const required = await createRequiredModel(admin, model);
	const { bot, chatId } = await requiringBot(api.as("member"), model, required);
	await admin.provider.update({
		id: model.providerId,
		enabled: false,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);
	await expect(
		page.getByText(
			message("chat_bot_model_notice_title", {
				bot: bot.name,
			}),
		),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("ai_elements_prompt_input_submit_aria_label"),
		}),
	).toBeDisabled();
});
