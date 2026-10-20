import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const typeOption = (page: Page, type: "template" | "database") =>
	page.getByRole("button", {
		name: `${message(`blocks_add_${type}_option_title`)} ${message(`blocks_add_${type}_option_description`)}`,
		exact: true,
	});

const templateSubmit = (page: Page) =>
	page.getByRole("button", {
		name: message("blocks_template_form_create_submit_button"),
	});

test("blocks: the add page offers template and repository", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/hub/blocks/add");

	const template = typeOption(page, "template");
	const database = typeOption(page, "database");

	await expect(template).toBeVisible();
	await expect(database).toBeVisible();
	await expect(template.locator("..").getByRole("button")).toHaveCount(2);
});

test("blocks: an image generation link opens the template form", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/hub/blocks/add?type=imageGeneration");

	await expect(page).toHaveURL(/\/app\/hub\/blocks\/add$/);
	await expect(
		page.getByText(message("blocks_add_template_form_description")),
	).toBeVisible();
	await expect(templateSubmit(page)).toBeVisible();
});
