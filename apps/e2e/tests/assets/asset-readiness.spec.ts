import type { BlockId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import {
	chatName,
	composer,
	createChat,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { ApiClient } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

/**
 * A repository of the client's own holding one uploaded asset. Outside the
 * pipeline specs no workers run, so queueing its processing fails and the
 * asset fails with kind `other`.
 */
const repositoryWithFailedAsset = async (client: ApiClient) => {
	const asset = await uploadAsset(client, chatName("Unprepared Asset"));
	const block = await client.block.create({
		type: "database",
		name: chatName("Unprepared Repository"),
		status: "ready",
		assets: [
			asset.id,
		],
		config: {
			minReferences: 1,
			maxReferences: 5,
			defaultReferences: 3,
		},
	});

	return {
		asset,
		blockId: block.data.id as BlockId,
		name: block.data.name,
	};
};

const assetsPanel = (page: Page) =>
	page.getByRole("region", {
		name: message("assets_panel_region"),
	});

test("assets: a chat shows the assets of its repositories that could not be prepared", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const repository = await repositoryWithFailedAsset(member);
	const chatId = await createChat(member, model, chatName("Readiness"));
	await member.chatBlock.attach({
		chatId,
		blockId: repository.blockId,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const trigger = assetsPanel(page).getByRole("button", {
		name: /1 asset could not be prepared.*0\/1/,
	});
	await expect(trigger).toBeVisible();
	await expect(
		assetsPanel(page).getByRole("link", {
			name: repository.name,
		}),
	).toHaveCount(0);

	await trigger.click();
	const row = assetsPanel(page).getByRole("listitem");
	await expect(
		row.getByRole("link", {
			name: repository.name,
		}),
	).toBeVisible();
	await expect(
		row.getByText(
			message("assets_panel_repository_count", {
				ready: 0,
				total: 1,
			}),
		),
	).toBeVisible();
	await expect(
		row.getByText(
			message("assets_panel_repository_failed_count", {
				count: 1,
			}),
		),
	).toBeVisible();
	await expect(composer(page)).toBeEnabled();
});

test("assets: the repository page shows a failed asset with why and Retry", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const repository = await repositoryWithFailedAsset(member);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/repositories/${repository.blockId}`);

	await expect(
		page.getByRole("status").filter({
			hasText: message("blocks_database_config_readiness_summary", {
				ready: 0,
				total: 1,
			}),
		}),
	).toContainText(
		message("blocks_database_config_readiness_failed", {
			count: 1,
		}),
	);
	await expect(
		page.getByText(message("asset_state_failed_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByText(message("pipeline_failure_other"))).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("blocks_database_config_prepare_failed_again_action"),
		}),
	).toBeVisible();
	await page
		.locator('[data-slot="tile"]')
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await expect(
		page.getByRole("menuitem", {
			name: message("assets_tile_retry_action"),
			exact: true,
		}),
	).toBeVisible();
});
