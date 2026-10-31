import type { ModelId, ProviderId } from "@orcai/core";
import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import {
	modelPickerDialog,
	pickModel,
	reasonOf,
} from "../../fixtures/assistant/assistant";
import { rejection } from "../../fixtures/authorization";
import {
	chatName,
	composer,
	setUpChatModel,
	skipChatTour,
} from "../../fixtures/chat/chat";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { openGuarded } from "../../fixtures/orgs/navigation";

// Specs here set the worker organisation's default chat model; later specs expect none.
test.afterEach(async ({ api, org }) => {
	await api.as("admin").organization.update({
		id: org.id,
		defaultChatModelId: null,
	});
});

const createModel = async (
	admin: ApiClient,
	providerId: ProviderId,
	capabilities: ("text" | "tool-calling")[] = [
		"text",
		"tool-calling",
	],
): Promise<{
	modelId: ModelId;
	name: string;
	providerModelId: string;
}> => {
	const providerModelId = `e2e-mock-default-${runId()}`;
	const name = chatName("Default Model");
	const created = await admin.model.create({
		providerId,
		providerModelId,
		name,
		description:
			"A further model on the mock for the default chat model specs.",
		isDeprecated: false,
		capabilities,
	});

	return {
		modelId: created.data.id,
		name,
		providerModelId,
	};
};

const defaultChatModelId = async (admin: ApiClient, id: string) =>
	(
		await admin.organization.find({
			id,
		})
	).data.defaultChatModelId;

const defaultChatModelField = (page: Page) =>
	page.getByRole("group", {
		name: message("orgs_form_default_chat_model_label"),
	});

const openOrganizationPage = async (page: Page, slug: string) => {
	await enterApp(page, slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);
};

/** The model button of the new chat page's composer. */
const starterModelButton = (page: Page, modelName: string) =>
	page.getByRole("main").getByRole("button", {
		name: modelName,
	});

test("orgs: organization.update refuses a default chat model without tool calling", async ({
	api,
	inference,
	org,
}) => {
	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const textOnly = await createModel(admin, chat.providerId, [
		"text",
	]);

	expect(
		reasonOf(
			await rejection(
				admin.organization.update({
					id: org.id,
					defaultChatModelId: textOnly.modelId,
				}),
			),
		),
	).toBe("MODEL_TOOLS_UNSUPPORTED");
	expect(await defaultChatModelId(admin, org.id)).toBeNull();
});

test("orgs: a new chat starts on the default chat model an admin chooses", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.slow();

	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const preferred = await createModel(admin, chat.providerId);
	// Newer, so it would lead without a default.
	const newest = await createModel(admin, chat.providerId);
	const { data: provider } = await admin.provider.find({
		id: chat.providerId,
	});

	const adminPage = await pageAs("admin");
	await openOrganizationPage(adminPage, org.slug);
	await expect(
		adminPage.getByText(message("orgs_form_default_chat_model_unset_hint")),
	).toBeVisible();
	await defaultChatModelField(adminPage).getByRole("button").first().click();
	const dialog = modelPickerDialog(adminPage);
	await dialog.getByRole("combobox").click();
	await adminPage
		.getByRole("option", {
			name: provider.name,
			exact: true,
		})
		.click();
	await dialog.getByRole("textbox").fill(preferred.name);
	await submitForm(adminPage, {
		fill: () => pickModel(adminPage, preferred.name),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect
		.poll(() => defaultChatModelId(admin, org.id))
		.toBe(preferred.modelId);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await skipChatTour(page);
	await open(page, "/app/chat/new");
	await expect(starterModelButton(page, preferred.name)).toBeVisible();

	// Only a request for the default model gets this reply.
	inference.respondWith({
		model: preferred.providerModelId,
		text: "Answered by the default chat model",
	});
	await composer(page).fill("Which model answers?");
	await composer(page).press("Enter");
	await page.waitForURL(/\/app\/chat\/[0-9a-f-]{36}/);
	await expect(
		page
			.getByRole("region", {
				name: message("message_scroller_viewport_label"),
			})
			.getByText("Answered by the default chat model"),
	).toBeVisible();

	// A deprecated default stays set, with a warning, and new chats skip it.
	await admin.model.update({
		id: preferred.modelId,
		isDeprecated: true,
	});
	await openOrganizationPage(adminPage, org.slug);
	await expect(
		defaultChatModelField(adminPage).getByText(
			message("orgs_form_default_chat_model_unusable_deprecated"),
		),
	).toBeVisible();
	await open(page, "/app/chat/new");
	await expect(starterModelButton(page, newest.name)).toBeVisible();
});
