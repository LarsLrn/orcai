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
 * A repository of the client's own holding one uploaded document. The suite
 * runs no workers, so queueing its processing fails and the document fails
 * with kind `other`.
 */
const repositoryWithFailedDocument = async (client: ApiClient) => {
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

const documentsPanel = (page: Page) =>
	page.getByRole("region", {
		name: message("documents_panel_region"),
	});

test("documents: a chat shows the documents of its repositories that could not be prepared", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});
	const repository = await repositoryWithFailedDocument(member);
	const chatId = await createChat(member, model, chatName("Readiness"));
	await member.chatBlock.attach({
		chatId,
		blockId: repository.blockId,
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	const trigger = documentsPanel(page).getByRole("button", {
		name: /1 document could not be prepared.*0\/1/,
	});
	await expect(trigger).toBeVisible();
	await expect(
		documentsPanel(page).getByRole("link", {
			name: repository.name,
		}),
	).toHaveCount(0);

	await trigger.click();
	const row = documentsPanel(page).getByRole("listitem");
	await expect(
		row.getByRole("link", {
			name: repository.name,
		}),
	).toBeVisible();
	await expect(
		row.getByText(
			message("documents_panel_repository_count", {
				ready: 0,
				total: 1,
			}),
		),
	).toBeVisible();
	await expect(
		row.getByText(
			message("documents_panel_repository_failed_count", {
				count: 1,
			}),
		),
	).toBeVisible();
	await expect(composer(page)).toBeEnabled();
});

test("documents: the repository page shows a failed document with why and Retry", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const repository = await repositoryWithFailedDocument(member);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/hub/blocks/${repository.blockId}`);

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
		page.getByText(message("document_state_failed_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByText(message("pipeline_failure_other"))).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("assets_card_retry_action"),
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("blocks_database_config_retry_failed_action"),
		}),
	).toBeVisible();
});
