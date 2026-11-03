import type { BlockId } from "@orcai/core";
import type { Locator, Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const REPOSITORIES_STEP = 2;

const createRepository = (client: ApiClient, name: string) =>
	client.block.create({
		type: "repository",
		name,
		status: "draft",
		assets: [],
		config: {
			minPassages: 1,
			maxPassages: 8,
			defaultPassages: 4,
		},
	});

const goToStep = (page: Page, title: string) =>
	page
		.getByRole("button", {
			name: title,
		})
		.click();

const publish = async (page: Page, picker: Locator) => {
	await picker.click();
	await page
		.getByRole("option", {
			name: message("common_status_ready_label"),
		})
		.click();
};

const storedStatus = (client: ApiClient, id: BlockId) =>
	expect.poll(
		async () =>
			(
				await client.block.find({
					id,
				})
			).data.status,
	);

test("bots: setup links an existing repository, publishes linked blocks at once, and removes links", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: `E2E Editor Behaviour ${runId()}`,
		status: "draft",
		config: {
			systemPrompt: "Created by the bot editor blocks spec.",
		},
	});
	const linked = await createRepository(
		member,
		`E2E Editor Linked Repository ${runId()}`,
	);
	const pickedName = `E2E Editor Picked Repository ${runId()}`;
	const picked = await createRepository(member, pickedName);
	const bot = await member.bot.save({
		name: `E2E Editor Bot ${runId()}`,
		description: "Created by the bot editor blocks spec.",
		status: "draft",
		behaviourId: behaviour.data.id,
		repositoryIds: [
			linked.data.id,
		],
	});
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(
		page,
		`/app/library/bots/${bot.data.id}/setup?step=${REPOSITORIES_STEP}`,
	);

	await page
		.getByRole("button", {
			name: message("authoring_repositories_add_existing_action"),
		})
		.click();
	const dialog = page.getByRole("dialog");
	await dialog
		.getByPlaceholder(
			message("blocks_selector_dialog_repository_search_placeholder"),
		)
		.fill(pickedName);
	await dialog
		.getByRole("option", {
			name: pickedName,
		})
		.click();
	await expect(dialog).toBeHidden();
	const names = page.getByLabel(message("common_name_label"));
	await expect(names.nth(1)).toHaveValue(pickedName);

	await goToStep(page, message("authoring_wizard_step_review_title"));
	// The linked repository is detached while its status write is pending.
	let release: () => void = () => undefined;
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/block/update**", async (route) => {
		await released;
		await route.continue();
	});
	const repositoryStatus = page.getByLabel(
		message("authoring_review_repository_status_label"),
	);
	const pending = page.waitForRequest("**/api/rpc/block/update**");
	await publish(page, repositoryStatus.first());
	await pending;
	await goToStep(page, message("authoring_wizard_step_repositories_title"));
	await page
		.getByRole("button", {
			name: message("common_remove_button"),
		})
		.first()
		.click();
	await expect(names).toHaveCount(1);
	release();
	await expect(
		page.getByText(message("blocks_status_toast_success_ready")),
	).toBeVisible();
	await storedStatus(member, linked.data.id).toBe("ready");
	await page.unroute("**/api/rpc/block/update**");

	await goToStep(page, message("authoring_wizard_step_review_title"));
	await expect(repositoryStatus).toHaveCount(1);
	await expect(repositoryStatus).toContainText(
		message("common_status_draft_label"),
	);
	await publish(page, repositoryStatus);
	await expect(repositoryStatus).toContainText(
		message("common_status_ready_label"),
	);
	await storedStatus(member, picked.data.id).toBe("ready");

	const behaviourStatus = page.getByLabel(
		message("authoring_review_behaviour_status_label"),
	);
	await publish(page, behaviourStatus);
	await expect(behaviourStatus).toContainText(
		message("common_status_ready_label"),
	);
	await storedStatus(member, behaviour.data.id).toBe("ready");

	await goToStep(page, message("authoring_wizard_step_repositories_title"));
	await page
		.getByRole("button", {
			name: message("common_remove_button"),
		})
		.click();
	await expect(
		page.getByRole("button", {
			name: message("authoring_repositories_use_existing_action"),
		}),
	).toBeVisible();
});
