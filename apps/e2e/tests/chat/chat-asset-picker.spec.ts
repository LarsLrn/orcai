import type { Page } from "@playwright/test";
import { uploadAsset } from "../../fixtures/assets";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const ASSET_LIST = "**/api/rpc/asset/list**";

const openAssetPicker = async (page: Page) => {
	await page
		.getByRole("button", {
			name: message("chat_attachment_menu_trigger"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("chat_attachment_menu_assets_action"),
		})
		.click();
	const dialog = page.getByRole("dialog", {
		name: message("chat_asset_picker_title"),
	});
	return {
		dialog,
		search: dialog.getByPlaceholder(
			message("chat_asset_picker_search_placeholder"),
		),
		position: (text: string) =>
			dialog
				.getByRole("navigation", {
					name: message("common_pagination_label"),
				})
				.getByText(text),
	};
};

test("chat: the composer's asset picker pages Library assets and chat uploads, searching from the first page", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpChatModel(api, inference);
	const member = api.as("member");
	const prefix = `E2E Composer Asset ${runId()}`;
	// One more than the picker's page; the oldest is a chat upload.
	await uploadAsset(member, `${prefix} 00.txt`, {
		route: "chatAttachment",
	});
	await Promise.all(
		Array.from(
			{
				length: 20,
			},
			(_, index) =>
				uploadAsset(
					member,
					`${prefix} ${String(index + 1).padStart(2, "0")}.txt`,
				),
		),
	);
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/chat/new");
	const { dialog, search, position } = await openAssetPicker(page);
	const row = (title: string) =>
		dialog.getByText(title, {
			exact: true,
		});

	await search.fill(prefix);
	await expect(row(`${prefix} 20.txt`)).toBeVisible();
	await expect(position("1 / 2")).toBeVisible();
	await expect(row(`${prefix} 00.txt`)).toBeHidden();
	await dialog
		.getByRole("button", {
			name: message("common_pagination_next_page_label"),
		})
		.click();
	await expect(position("2 / 2")).toBeVisible();
	await expect(row(`${prefix} 00.txt`)).toBeVisible();
	await expect(
		dialog.getByText(message("assets_chat_upload_badge")),
	).toBeVisible();

	// A new search reads its first page; ten results fit on one.
	await search.fill(`${prefix} 1`);
	await expect(row(`${prefix} 19.txt`)).toBeVisible();
	await expect(row(`${prefix} 10.txt`)).toBeVisible();
	await expect(row(`${prefix} 00.txt`)).toBeHidden();
	await expect(dialog.getByRole("navigation")).toBeHidden();

	await search.fill(`E2E No Match ${runId()}`);
	await expect(
		dialog.getByText(message("chat_asset_picker_empty_state_title")),
	).toBeVisible();

	// Closing the dialog clears its search.
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
	await openAssetPicker(page);
	await expect(search).toHaveValue("");
});

test("chat: a failed asset list in the composer's picker shows the error and loads again on retry", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	await setUpChatModel(api, inference);
	const member = api.as("member");
	const title = `E2E Composer Retry ${runId()}.txt`;
	await uploadAsset(member, title);
	await member.user.setTourState({
		tourId: "chatTour",
		state: "completed",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, "/app/chat/new");
	await page.clock.install();
	await page.route(ASSET_LIST, (route) => route.abort());

	const { dialog, search } = await openAssetPicker(page);
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
		dialog.getByText(message("chat_asset_picker_empty_state_title")),
	).toBeHidden();

	await page.unroute(ASSET_LIST);
	await failure
		.getByRole("button", {
			name: message("common_retry_button"),
		})
		.click();
	await expect(failure).toBeHidden();
	await search.fill(title);
	await page.clock.fastForward(500);
	await expect(
		dialog.getByText(title, {
			exact: true,
		}),
	).toBeVisible();
});
