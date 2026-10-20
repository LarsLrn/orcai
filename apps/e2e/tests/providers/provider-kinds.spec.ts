import type { Page } from "@playwright/test";
import { rejection, untilAllowed } from "../../fixtures/authorization";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const providerName = (label: string) => `Providers ${label} ${runId()}`;

const fields = {
	description: "",
	meteringMode: "tokens",
	apiKey: "e2e-key",
	enabled: true,
} as const;

const kindPicker = (page: Page) =>
	page.getByRole("combobox", {
		name: message("providers_form_kind_label"),
	});

const endpointField = (page: Page) =>
	page.getByRole("textbox", {
		name: message("providers_form_endpoint_label"),
	});

const pickKind = async (page: Page, label: string) => {
	await kindPicker(page).click();
	await page
		.getByRole("option", {
			name: label,
			exact: true,
		})
		.click();
	await expect(kindPicker(page)).toContainText(label);
};

const openAddProvider = async (page: Page) => {
	await open(page, "/app/providers/add");
	await expect(
		page.getByRole("heading", {
			name: message("providers_add_page_title"),
		}),
	).toBeVisible();
};

test("providers: the create form asks for an endpoint only for OpenAI-compatible providers", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openAddProvider(page);

	await expect(kindPicker(page)).toContainText(
		message("providers_kind_openai_compatible_label"),
	);
	await expect(endpointField(page)).toBeVisible();

	for (const kind of [
		"providers_kind_openai_label",
		"providers_kind_anthropic_label",
	]) {
		await pickKind(page, message(kind));
		await expect(endpointField(page)).toHaveCount(0);
		await expect(
			page.getByText(message("providers_form_endpoint_default_hint")),
		).toBeVisible();
	}

	await pickKind(page, message("providers_kind_openai_compatible_label"));
	await expect(endpointField(page)).toBeVisible();
	await page
		.getByLabel(message("common_name_label"))
		.fill(providerName("No endpoint"));
	await page
		.getByLabel(message("providers_form_api_key_label"))
		.fill("e2e-key");
	await page
		.getByRole("button", {
			name: message("providers_form_save_button"),
		})
		.click();

	await expect(
		page.getByText(message("error_provider_endpoint_required")),
	).toBeVisible();
	await expect(page).toHaveURL(/\/app\/providers\/add/);
});

test("providers: an Anthropic provider needs no endpoint and keeps its kind on edit", async ({
	api,
	org,
	pageAs,
}) => {
	const name = providerName("Anthropic");
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openAddProvider(page);

	await submitForm(page, {
		fill: async () => {
			await pickKind(page, message("providers_kind_anthropic_label"));
			await page.getByLabel(message("common_name_label")).fill(name);
			await page
				.getByLabel(message("providers_form_api_key_label"))
				.fill("e2e-key");
		},
		submit: message("providers_form_save_button"),
		until: /\/app\/providers\/[0-9a-f-]{36}$/,
	});
	await expect(
		page.getByRole("heading", {
			name,
		}),
	).toBeVisible();
	await expect(
		page.getByText(message("providers_detail_endpoint_default")).first(),
	).toBeVisible();

	const providerId = new URL(page.url()).pathname.split("/").at(-1) as string;
	const { data: provider } = await api.as("admin").provider.find({
		id: providerId,
	});
	expect(provider).toMatchObject({
		kind: "anthropic",
		endpoint: null,
	});

	await open(page, `/app/providers/${providerId}/edit`);
	await expect(kindPicker(page)).toBeDisabled();
	await expect(kindPicker(page)).toContainText(
		message("providers_kind_anthropic_label"),
	);
	await expect(endpointField(page)).toHaveCount(0);
});

test("providers: the API checks the endpoint against the kind", async ({
	api,
}) => {
	const admin = api.as("admin");

	const compatible = await untilAllowed(() =>
		admin.provider.create({
			...fields,
			name: providerName("Compatible"),
			kind: "openai-compatible",
			endpoint: "https://llm.example.org/v1",
		}),
	);
	const anthropic = await admin.provider.create({
		...fields,
		name: providerName("Official"),
		kind: "anthropic",
		endpoint: null,
	});
	expect(anthropic.data).toMatchObject({
		kind: "anthropic",
		endpoint: null,
	});

	for (const invalid of [
		() =>
			admin.provider.create({
				...fields,
				name: providerName("Missing endpoint"),
				kind: "openai-compatible",
				endpoint: null,
			}),
		() =>
			admin.provider.create({
				...fields,
				name: providerName("Extra endpoint"),
				kind: "openai",
				endpoint: "https://llm.example.org/v1",
			}),
	]) {
		const error = await rejection(invalid());
		expect(error.code).toBe("INPUT_VALIDATION_FAILED");
		expect(error.data).toMatchObject({
			fieldErrors: {
				endpoint: expect.any(Array),
			},
		});
	}

	expect(
		(
			await rejection(
				admin.provider.update({
					id: compatible.data.id,
					endpoint: null,
				}),
			)
		).data,
	).toMatchObject({
		reason: "PROVIDER_ENDPOINT_REQUIRED",
	});
	expect(
		(
			await rejection(
				admin.provider.update({
					id: anthropic.data.id,
					endpoint: "https://llm.example.org/v1",
				}),
			)
		).data,
	).toMatchObject({
		reason: "PROVIDER_ENDPOINT_NOT_ALLOWED",
	});
});
