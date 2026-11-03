import type { Page } from "@playwright/test";
import { createApiClient } from "../../fixtures/api";
import {
	INSTANCE_ORGANISATION,
	WELL_KNOWN_ADMIN,
} from "../../fixtures/constants";
import { baseURL } from "../../fixtures/env";
import { submitForm } from "../../fixtures/forms";
import { expect, signIn, test } from "../../fixtures/index";
import { INFERENCE_MOCK_MODELS } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

// The second test points a reused instance at the mock, after the first set up a fresh one.
test.describe.configure({
	mode: "serial",
});

const inferenceURL = `http://127.0.0.1:${process.env.E2E_INFERENCE_PORT}/v1`;

/** Saves the mock inference server as the embedding endpoint, keeping a stored model. */
const pointEmbeddingsAtMock = async (page: Page) => {
	const baseUrl = page.getByLabel(
		message("instance_settings_embeddings_base_url_label"),
	);
	const model = page.getByLabel(
		message("instance_settings_embeddings_model_label"),
	);
	await baseUrl.fill(inferenceURL);
	await page
		.getByLabel(message("instance_settings_embeddings_api_key_label"))
		.fill("e2e-mock-key");
	await page
		.getByRole("button", {
			name: message("instance_settings_embeddings_load_models_button"),
		})
		.click();
	await expect(
		page.locator(`datalist option[value="${INFERENCE_MOCK_MODELS.embedding}"]`),
	).toHaveCount(1);
	if ((await model.inputValue()) === "") {
		await model.fill(INFERENCE_MOCK_MODELS.embedding);
	}
	await page
		.getByRole("button", {
			name: message("instance_settings_embeddings_save_button"),
		})
		.click();
	await expect(
		page.getByText(message("instance_settings_embeddings_saved_toast")),
	).toBeVisible();
	await expect(
		page.getByText(
			message("instance_settings_embeddings_dimensions_note", {
				dimensions: "1,024",
			}),
		),
	).toBeVisible();
};

test("initialises the instance with the well-known admin and sets up embeddings", async ({
	page,
}) => {
	const api = createApiClient(baseURL());
	const before = await api.bootstrap.status({});

	test.skip(
		before.data.initialized,
		"Instance already initialised; reusing the well-known admin",
	);

	await open(page, "/init");

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel(message("auth_init_form_organization_name_label"))
				.fill(INSTANCE_ORGANISATION.name);
			await page
				.getByLabel(message("auth_init_form_organization_slug_label"))
				.fill(INSTANCE_ORGANISATION.slug);
			await page
				.getByLabel(message("auth_init_form_admin_name_label"))
				.fill(WELL_KNOWN_ADMIN.name);
			await page
				.getByLabel(message("auth_init_form_admin_email_label"))
				.fill(WELL_KNOWN_ADMIN.email);
			await page
				.getByLabel(message("common_password_label"), {
					exact: true,
				})
				.fill(WELL_KNOWN_ADMIN.password);
			await page
				.getByLabel(message("auth_init_form_confirm_password_label"))
				.fill(WELL_KNOWN_ADMIN.password);
			await page
				.getByRole("switch", {
					name: message("auth_init_form_privacy_consent_label"),
				})
				.check();
		},
		submit: message("auth_init_form_submit_button"),
		until: /\/instance\/settings$/,
	});

	const after = await api.bootstrap.status({});
	expect(after.data.initialized).toBe(true);

	// A fresh instance has no embeddings: the first admin sets them up or skips.
	await expect(
		page.getByText(message("instance_settings_embeddings_unset_title")),
	).toBeVisible();
	await expect(
		page.getByRole("link", {
			name: message("instance_settings_embeddings_later_action"),
		}),
	).toHaveAttribute("href", "/app");

	await pointEmbeddingsAtMock(page);
	await expect(
		page.getByText(message("instance_settings_embeddings_unset_title")),
	).toBeHidden();
});

test("points the embedding endpoint of a reused instance at the inference mock", async ({
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/settings");
	const baseUrl = page.getByLabel(
		message("instance_settings_embeddings_base_url_label"),
	);
	test.skip(
		(await baseUrl.inputValue()) === inferenceURL,
		"The embedding endpoint is the inference mock already",
	);
	await pointEmbeddingsAtMock(page);
});

// Specs enter the app as the well-known admin, and the tour's card would cover it.
test("the well-known admin has skipped the initial tour", async () => {
	const admin = await signIn(baseURL(), WELL_KNOWN_ADMIN);
	await createApiClient(baseURL(), admin.cookieHeader).user.setTourState({
		tourId: "initialTour",
		state: "skipped",
	});
});
