import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("blocks: each kind's add page opens its own form", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("member");
	await enterApp(page, org.slug);

	await open(page, "/app/library/behaviours/add");
	await expect(
		page.getByRole("button", {
			name: message("blocks_template_form_create_submit_button"),
		}),
	).toBeVisible();

	await open(page, "/app/library/repositories/add");
	await expect(
		page.getByRole("button", {
			name: message("blocks_database_form_create_submit_button"),
		}),
	).toBeVisible();
});

test("blocks: a behaviour under the repositories path is not found", async ({
	api,
	org,
	pageAs,
}) => {
	const name = `E2E Block Path ${runId()}`;
	const block = await api.as("member").block.create({
		type: "template",
		name,
		status: "ready",
		config: {
			systemPrompt: "Created by the block paths spec.",
		},
	});
	const page = await pageAs("member");
	await enterApp(page, org.slug);

	await open(page, `/app/library/behaviours/${block.data.id}`);
	await expect(
		page.getByRole("heading", {
			name,
		}),
	).toBeVisible();

	await open(page, `/app/library/repositories/${block.data.id}`);
	await expect(
		page.getByRole("heading", {
			name: message("boundaries_not_found_title"),
		}),
	).toBeVisible();
});
