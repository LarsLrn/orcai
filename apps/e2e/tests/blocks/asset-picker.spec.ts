import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("blocks: a failed Library list in the asset picker shows the error and loads again on retry", async ({
	api,
	org,
	pageAs,
}) => {
	const title = `E2E Picker Asset ${runId()}.txt`;
	await uploadAsset(api.as("member"), title);
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await page.clock.install();
	await open(page, "/app/library/repositories/add");
	await page.route("**/api/rpc/asset/list**", (route) => route.abort());

	await page
		.getByRole("button", {
			name: message("authoring_repository_add_existing_action"),
		})
		.click();
	const dialog = page.getByRole("dialog");
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
		dialog.getByText(message("assets_library_picker_empty_state")),
	).toBeHidden();

	await page.unroute("**/api/rpc/asset/list**");
	await failure
		.getByRole("button", {
			name: message("common_retry_button"),
		})
		.click();
	await expect(failure).toBeHidden();
	const search = dialog.getByPlaceholder(
		message("assets_library_picker_search_placeholder"),
	);
	await search.fill(title);
	await expect(dialog.getByText(title)).toBeVisible();

	await search.fill(`E2E No Match ${runId()}`);
	await expect(
		dialog.getByText(message("assets_library_picker_empty_state")),
	).toBeVisible();
});

test("blocks: the asset picker pages past its first 24 Library assets and searches from the first page", async ({
	api,
	orgs,
	pageAs,
}) => {
	const org = await orgs.create("Asset Picker Paging");
	const member = api.as("member", org);
	const oldest = "E2E Paged Asset 00.txt";
	await uploadAsset(member, oldest);
	// One picker page of newer assets, and a chat upload the picker leaves out.
	await Promise.all([
		...Array.from(
			{
				length: 24,
			},
			(_, index) =>
				uploadAsset(
					member,
					`E2E Paged Asset ${String(index + 1).padStart(2, "0")}.txt`,
				),
		),
		uploadAsset(member, "E2E Chat Upload.txt", {
			route: "chatAttachment",
		}),
	]);
	const page = await pageAs("member", org);
	await enterApp(page, org.slug);
	await open(page, "/app/library/repositories/add");
	await page
		.getByRole("button", {
			name: message("authoring_repository_add_existing_action"),
		})
		.click();
	const dialog = page.getByRole("dialog");
	const pager = dialog.getByRole("navigation", {
		name: message("common_pagination_label"),
	});
	const next = pager.getByRole("button", {
		name: message("common_pagination_next_page_label"),
	});
	await expect(dialog.getByText("E2E Paged Asset 24.txt")).toBeVisible();
	await expect(pager.getByText("1 / 2")).toBeVisible();
	await expect(dialog.getByText(oldest)).toBeHidden();

	// While the second page loads, the pager stays and the grid shows the wait.
	let release: (() => void) | undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/rpc/asset/list**", async (route) => {
		await held;
		await route.fallback();
	});
	await next.click();
	await expect(
		dialog.getByRole("status", {
			name: message("common_loading_label"),
		}),
	).toBeVisible();
	await expect(pager.getByText("2 / 2")).toBeVisible();
	release?.();
	await expect(dialog.getByText(oldest)).toBeVisible();
	await expect(dialog.getByText("E2E Chat Upload.txt")).toBeHidden();
	await page.unroute("**/api/rpc/asset/list**");

	const search = dialog.getByPlaceholder(
		message("assets_library_picker_search_placeholder"),
	);
	await search.fill("E2E Paged Asset 2");
	await expect(dialog.getByText("E2E Paged Asset 24.txt")).toBeVisible();
	await expect(dialog.getByText("E2E Paged Asset 20.txt")).toBeVisible();
	await expect(pager).toBeHidden();

	await search.clear();
	await expect(pager.getByText("1 / 2")).toBeVisible();
	await expect(dialog.getByText("E2E Paged Asset 24.txt")).toBeVisible();
	await expect(dialog.getByText(oldest)).toBeHidden();
});
