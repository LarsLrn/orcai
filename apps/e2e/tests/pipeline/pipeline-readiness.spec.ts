import type { Page } from "@playwright/test";
import {
	chatName,
	createChat,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import {
	preparedReadiness,
	repositoryWithAsset,
} from "../../fixtures/pipeline/repository";

const readyRepository = (client: ApiClient) =>
	repositoryWithAsset(client, {
		label: "Syllabus",
		content:
			"# Syllabus\n\nWeek one covers cell biology. Week two covers genetics.\n",
	});

/** Whitespace only: extraction finds nothing, which retrying cannot change. */
const emptyRepository = (client: ApiClient) =>
	repositoryWithAsset(client, {
		label: "Blank",
		content: " \n\n \n",
		type: "text/plain",
	});

const assetsPanel = (page: Page) =>
	page.getByRole("region", {
		name: message("assets_panel_region"),
	});

const readinessSummary = (page: Page, ready: number, total: number) =>
	page.getByRole("status").filter({
		hasText: message("blocks_database_config_readiness_summary", {
			ready,
			total,
		}),
	});

/** The header's Retry failed, or an asset tile's menu, which holds only Retry. */
const retryOffers = (page: Page) =>
	page
		.getByRole("button", {
			name: message("blocks_database_config_prepare_failed_again_action"),
			exact: true,
		})
		.or(
			page.locator('[data-slot="tile"]').getByRole("button", {
				name: message("common_more_actions"),
			}),
		);

test("pipeline: a chat shows which of its repositories are ready and which failed", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const ready = await readyRepository(member);
	const empty = await emptyRepository(member);
	const chatId = await createChat(member, model, chatName("Pipeline"));
	for (const repository of [
		ready,
		empty,
	]) {
		await member.chatBlock.attach({
			chatId,
			blockId: repository.blockId,
		});
		await preparedReadiness(member, repository.blockId);
	}

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const trigger = assetsPanel(page).getByRole("button", {
		name: /1 asset could not be prepared.*1\/2/,
	});
	await expect(trigger).toBeVisible();
	await trigger.click();

	const readyRow = assetsPanel(page)
		.getByRole("listitem")
		.filter({
			has: page.getByRole("link", {
				name: ready.name,
			}),
		});
	await expect(
		readyRow.getByRole("img", {
			name: message("assets_panel_repository_ready"),
		}),
	).toBeVisible();
	await expect(
		readyRow.getByText(
			message("assets_panel_repository_count", {
				ready: 1,
				total: 1,
			}),
		),
	).toBeVisible();

	const emptyRow = assetsPanel(page)
		.getByRole("listitem")
		.filter({
			has: page.getByRole("link", {
				name: empty.name,
			}),
		});
	await expect(
		emptyRow.getByRole("img", {
			name: message("assets_panel_repository_failed"),
		}),
	).toBeVisible();
	await expect(
		emptyRow.getByText(
			message("assets_panel_repository_failed_count", {
				count: 1,
			}),
		),
	).toBeVisible();
});

test("pipeline: the repository page shows a prepared asset as ready", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const repository = await readyRepository(member);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/repositories/${repository.blockId}`);

	await expect(readinessSummary(page, 1, 1)).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		page.getByText(message("asset_state_ready_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(retryOffers(page)).toHaveCount(0);
});

test("pipeline: the repository page says why an empty asset failed and offers no retry", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const repository = await emptyRepository(member);
	const readiness = await preparedReadiness(member, repository.blockId);
	expect(readiness.assets).toMatchObject([
		{
			state: "failed",
			failure: {
				stage: "processing",
				kind: "empty",
			},
		},
	]);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/repositories/${repository.blockId}`);

	await expect(readinessSummary(page, 0, 1)).toContainText(
		message("blocks_database_config_readiness_failed", {
			count: 1,
		}),
	);
	await expect(
		page.getByText(message("asset_state_failed_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByText(message("pipeline_failure_empty"))).toBeVisible();
	await expect(retryOffers(page)).toHaveCount(0);
});
