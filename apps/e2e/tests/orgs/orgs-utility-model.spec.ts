import type { ChatId, ModelId, ProviderId } from "@orcai/core";
import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import {
	modelPickerDialog,
	pickModel,
	reasonOf,
} from "../../fixtures/assistant/assistant";
import { expectForbidden, rejection } from "../../fixtures/authorization";
import { ask, chatName, setUpChatModel } from "../../fixtures/chat/chat";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { openGuarded } from "../../fixtures/orgs/navigation";

// Specs here set the worker organisation's utility model; later specs expect none.
test.afterEach(async ({ api, org }) => {
	await api.as("admin").organization.update({
		id: org.id,
		utilityModelId: null,
	});
});

const createModel = async (
	admin: ApiClient,
	providerId: ProviderId,
	overrides: {
		isDeprecated?: boolean;
		capabilities?: ("text" | "tool-calling" | "embedding")[];
	} = {},
): Promise<{
	modelId: ModelId;
	name: string;
	providerModelId: string;
}> => {
	const providerModelId = `e2e-mock-utility-${runId()}`;
	const name = chatName("Utility Model");
	const created = await admin.model.create({
		providerId,
		providerModelId,
		name,
		description: "A further model on the mock for the utility model specs.",
		isDeprecated: overrides.isDeprecated ?? false,
		capabilities: overrides.capabilities ?? [
			"text",
		],
	});

	return {
		modelId: created.data.id,
		name,
		providerModelId,
	};
};

const utilityModelId = async (admin: ApiClient, id: string) =>
	(
		await admin.organization.find({
			id,
		})
	).data.utilityModelId;

const utilityModelField = (page: Page) =>
	page.getByRole("group", {
		name: message("orgs_form_utility_model_label"),
	});

test("orgs: organization.update refuses a utility model that cannot write text", async ({
	api,
	inference,
	org,
}) => {
	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const deprecated = await createModel(admin, chat.providerId, {
		isDeprecated: true,
	});
	const embedding = await createModel(admin, chat.providerId, {
		capabilities: [
			"embedding",
		],
	});
	const textOnly = await createModel(admin, chat.providerId);

	const refusal = async (modelId: ModelId) =>
		reasonOf(
			await rejection(
				admin.organization.update({
					id: org.id,
					utilityModelId: modelId,
				}),
			),
		);

	expect(await refusal(deprecated.modelId)).toBe("MODEL_DEPRECATED");
	expect(await refusal(embedding.modelId)).toBe("MODEL_TEXT_UNSUPPORTED");
	await expectForbidden(
		api.as("manager").organization.update({
			id: org.id,
			utilityModelId: textOnly.modelId,
		}),
	);

	// Titles need no tool calling.
	await admin.organization.update({
		id: org.id,
		utilityModelId: textOnly.modelId,
	});
	expect(await utilityModelId(admin, org.id)).toBe(textOnly.modelId);
});

test("orgs: the utility model writes chat titles, and the chat's model does while none is set", async ({
	api,
	inference,
	org,
}) => {
	const admin = api.as("admin");
	const member = api.as("member");
	const chat = await setUpChatModel(api, inference);
	const utility = await createModel(admin, chat.providerId);
	await admin.organization.update({
		id: org.id,
		utilityModelId: utility.modelId,
	});

	const titleOfNewChat = async (): Promise<string | null> => {
		const { data } = await member.chat.create({
			config: chat,
		});
		const chatId: ChatId = data.id;
		await ask(member, chatId, "How fast are refunds paid?");
		await expect
			.poll(
				async () =>
					(
						await member.chat.find({
							id: chatId,
						})
					).data.title,
			)
			.not.toBeNull();
		return (
			await member.chat.find({
				id: chatId,
			})
		).data.title;
	};

	inference.respondWith({
		text: "Chat reply",
	});
	inference.respondWith({
		model: utility.providerModelId,
		text: "Refund timing",
	});
	expect(await titleOfNewChat()).toBe("Refund timing");

	await admin.organization.update({
		id: org.id,
		utilityModelId: null,
	});
	expect(await titleOfNewChat()).toBe("Chat reply");
});

test("orgs: an admin chooses and clears the utility model on the organisation page", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.slow();

	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const textOnly = await createModel(admin, chat.providerId);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);
	await expect(
		page.getByText(message("orgs_form_utility_model_unset_hint")),
	).toBeVisible();

	// The picker offers text models without tool calling.
	const { data: provider } = await admin.provider.find({
		id: chat.providerId,
	});
	await utilityModelField(page).getByRole("button").first().click();
	const dialog = modelPickerDialog(page);
	await dialog.getByRole("combobox").click();
	await page
		.getByRole("option", {
			name: provider.name,
			exact: true,
		})
		.click();
	await dialog.getByRole("textbox").fill(textOnly.name);

	await submitForm(page, {
		fill: () => pickModel(page, textOnly.name),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect.poll(() => utilityModelId(admin, org.id)).toBe(textOnly.modelId);
	await expect(utilityModelField(page)).toContainText(textOnly.name);

	await submitForm(page, {
		fill: () =>
			utilityModelField(page)
				.getByRole("button", {
					name: message("orgs_form_model_clear_action"),
				})
				.click(),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect.poll(() => utilityModelId(admin, org.id)).toBeNull();
	await expect(
		page.getByText(message("orgs_form_utility_model_unset_hint")),
	).toBeVisible();
});
