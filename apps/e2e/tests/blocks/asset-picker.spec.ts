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
