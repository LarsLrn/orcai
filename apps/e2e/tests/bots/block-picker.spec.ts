import type { Page } from "@playwright/test";
import type { ApiClient } from "../../fixtures/api";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const createBehaviour = (
	client: ApiClient,
	name: string,
	status: "ready" | "draft" = "ready",
) =>
	client.block.create({
		type: "behaviour",
		name,
		status,
		config: {
			systemPrompt: "Created by the block picker spec.",
		},
	});

/** Opens the behaviour picker of a new bot. */
const openBehaviourPicker = async (page: Page) => {
	await open(page, "/app/library/bots/add");
	await page
		.getByLabel(message("authoring_basics_name_label"))
		.fill(`E2E Picker Bot ${runId()}`);
	await page
		.getByLabel(message("authoring_basics_description_label"))
		.fill("Created by the block picker spec.");
	await page
		.getByRole("button", {
			name: message("common_next_button"),
		})
		.click();
	await expect(page).toHaveURL(/step=1/);
	await page
		.getByRole("button", {
			name: message("authoring_behaviour_use_existing_action"),
		})
		.click();
	const dialog = page.getByRole("dialog");
	return {
		dialog,
		search: dialog.getByPlaceholder(
			message("blocks_selector_dialog_behaviour_search_placeholder"),
		),
	};
};

test("bots: the behaviour picker reaches a behaviour on its second page, by paging and by search", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("Block Picker Paging");
	const member = api.as("member", org);
	const name = `E2E Oldest Behaviour ${runId()}`;
	await createBehaviour(member, name);
	// One picker page of newer behaviours.
	await Promise.all(
		Array.from(
			{
				length: 12,
			},
			(_, index) => createBehaviour(member, `E2E Newer Behaviour ${index}`),
		),
	);
	const page = await pageAs("member", org);
	await enterApp(page, org.slug);

	const { dialog, search } = await openBehaviourPicker(page);
	const oldest = dialog.getByRole("option", {
		name,
	});
	await expect(dialog.getByRole("option")).toHaveCount(12);
	await expect(oldest).toBeHidden();
	await dialog.getByLabel(message("common_pagination_next_page_label")).click();
	await expect(oldest).toBeVisible();

	// Back on page 1, a single option can only be the search result.
	await dialog
		.getByLabel(message("common_pagination_previous_page_label"))
		.click();
	await expect(dialog.getByRole("option")).toHaveCount(12);
	await search.fill(name);
	await expect(dialog.getByRole("option")).toHaveCount(1);
	await expect(
		dialog.getByRole("option", {
			name: "E2E Newer Behaviour",
		}),
	).toHaveCount(0);
	await oldest.click();

	await expect(dialog).toBeHidden();
	await expect(page.getByLabel(message("common_name_label"))).toHaveValue(name);
});

test("bots: a failed behaviour list shows the error and loads again on retry", async ({
	api,
	org,
	pageAs,
}) => {
	const name = `E2E Draft Behaviour ${runId()}`;
	await createBehaviour(api.as("member"), name, "draft");
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await page.clock.install();
	await page.route("**/api/rpc/block/list**", (route) => route.abort());

	const { dialog, search } = await openBehaviourPicker(page);
	const failure = dialog.getByRole("alert");
	// Fast-forwards the query's retry backoff until it gives up.
	await expect(async () => {
		await page.clock.fastForward(4_000);
		await expect(failure).toContainText(message("error_generic_unknown"), {
			timeout: 100,
		});
	}).toPass({
		intervals: [
			100,
		],
	});
	await expect(
		dialog.getByText(
			message("blocks_selector_dialog_behaviour_empty_state_title"),
		),
	).toBeHidden();

	await page.unroute("**/api/rpc/block/list**");
	await failure
		.getByRole("button", {
			name: message("common_retry_button"),
		})
		.click();
	await expect(failure).toBeHidden();
	await search.fill(name);
	await expect(
		dialog.getByRole("option", {
			name,
		}),
	).toBeVisible();

	await search.fill(`E2E No Match ${runId()}`);
	await expect(
		dialog.getByText(
			message("blocks_selector_dialog_behaviour_empty_state_title"),
		),
	).toBeVisible();
});
