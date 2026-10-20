import {
	assistantModelField,
	createMockModel,
	modelPickerDialog,
	openAssistantModelPicker,
	pickModel,
	reasonOf,
	setAssistantModel,
	startConversation,
	turnRefusal,
} from "../../fixtures/assistant/assistant";
import {
	expectForbidden,
	rejection,
	untilAllowed,
} from "../../fixtures/authorization";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import { openGuarded } from "../../fixtures/orgs/navigation";

test("assistant: organization.update refuses an assistant model that cannot answer", async ({
	api,
	inference,
	org,
	orgs,
}) => {
	const admin = api.as("admin");
	const usable = await setUpChatModel(api, inference);
	const deprecated = await createMockModel(admin, usable.providerId, {
		isDeprecated: true,
	});
	const textOnly = await createMockModel(admin, usable.providerId, {
		capabilities: [
			"text",
		],
	});
	const disabled = await setUpChatModel(api, inference);
	await admin.provider.update({
		id: disabled.providerId,
		enabled: false,
	});

	const refusal = async (modelId: typeof usable.modelId) =>
		reasonOf(
			await rejection(
				admin.organization.update({
					id: org.id,
					assistantModelId: modelId,
				}),
			),
		);

	expect(await refusal(disabled.modelId)).toBe("PROVIDER_DISABLED");
	expect(await refusal(deprecated.modelId)).toBe("MODEL_DEPRECATED");
	expect(await refusal(textOnly.modelId)).toBe("MODEL_TOOLS_UNSUPPORTED");

	// A model of the worker organisation is unknown to any other.
	const other = await orgs.create("E2E Assistant Neighbour");
	const otherAdmin = api.as("admin", other);
	const foreign = await untilAllowed(() =>
		rejection(
			otherAdmin.organization.update({
				id: other.id,
				assistantModelId: usable.modelId,
			}),
		).then((error) => {
			if (error.code === "FORBIDDEN") throw error;
			return error;
		}),
	);
	expect(reasonOf(foreign)).toBe("MODEL_NOT_FOUND");

	await expectForbidden(
		api.as("manager").organization.update({
			id: org.id,
			assistantModelId: usable.modelId,
		}),
	);

	await setAssistantModel(admin, org, usable.modelId);
	expect(
		(
			await admin.organization.find({
				id: org.id,
			})
		).data.assistantModelId,
	).toBe(usable.modelId);

	await setAssistantModel(admin, org, null);
	expect(
		(
			await admin.organization.find({
				id: org.id,
			})
		).data.assistantModelId,
	).toBeNull();
});

test("assistant: deleting the assistant model clears the setting", async ({
	api,
	inference,
	org,
}) => {
	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const model = await createMockModel(admin, chat.providerId);
	await setAssistantModel(admin, org, model.modelId);

	await admin.model.delete({
		refs: [
			{
				id: model.modelId,
			},
		],
	});

	expect(
		(
			await admin.organization.find({
				id: org.id,
			})
		).data.assistantModelId,
	).toBeNull();
	const member = api.as("member");
	const chatId = await startConversation(member);
	expect(reasonOf(await turnRefusal(member, chatId))).toBe(
		"ASSISTANT_MODEL_NOT_CONFIGURED",
	);
});

test("assistant: an admin chooses, keeps an unusable, and clears the assistant model on the organisation page", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	test.slow();

	const admin = api.as("admin");
	const chat = await setUpChatModel(api, inference);
	const chosen = await createMockModel(admin, chat.providerId);
	const deprecated = await createMockModel(admin, chat.providerId, {
		isDeprecated: true,
	});
	const textOnly = await createMockModel(admin, chat.providerId, {
		capabilities: [
			"text",
		],
	});
	await setAssistantModel(admin, org, null);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGuarded(
		page,
		"/app/organization",
		message("orgs_settings_page_title"),
	);

	await expect(
		page.getByText(message("orgs_form_assistant_model_unset_hint")),
	).toBeVisible();

	// The picker offers the provider's usable models only.
	const { data: provider } = await admin.provider.find({
		id: chat.providerId,
	});
	await openAssistantModelPicker(page, provider.name, "E2E Chat Model");
	const dialog = modelPickerDialog(page);
	await expect(
		dialog.getByRole("option", {
			name: new RegExp(chosen.name),
		}),
	).toBeVisible();
	await expect(
		dialog.getByRole("option", {
			name: new RegExp(deprecated.name),
		}),
	).toHaveCount(0);
	await expect(
		dialog.getByRole("option", {
			name: new RegExp(textOnly.name),
		}),
	).toHaveCount(0);

	await submitForm(page, {
		fill: () => pickModel(page, chosen.name),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect
		.poll(
			async () =>
				(
					await admin.organization.find({
						id: org.id,
					})
				).data.assistantModelId,
		)
		.toBe(chosen.modelId);

	// Deprecating the current model blocks nothing, but the page warns.
	await admin.model.update({
		id: chosen.modelId,
		isDeprecated: true,
	});
	await page.reload();
	await expect(assistantModelField(page)).toContainText(chosen.name);
	await expect(
		page.getByText(message("orgs_form_assistant_model_unusable_deprecated")),
	).toBeVisible();

	await submitForm(page, {
		fill: () =>
			assistantModelField(page)
				.getByRole("button", {
					name: message("orgs_form_assistant_model_clear_action"),
				})
				.click(),
		submit: message("orgs_form_submit_button"),
		until: /\/app\/organization$/,
	});
	await expect
		.poll(
			async () =>
				(
					await admin.organization.find({
						id: org.id,
					})
				).data.assistantModelId,
		)
		.toBeNull();
	await expect(
		page.getByText(message("orgs_form_assistant_model_unset_hint")),
	).toBeVisible();
});
