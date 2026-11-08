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
			name: message("blocks_behaviour_form_create_submit_button"),
		}),
	).toBeVisible();

	await open(page, "/app/library/repositories/add");
	await expect(
		page.getByRole("button", {
			name: message("blocks_repository_form_create_submit_button"),
		}),
	).toBeVisible();
});

test("blocks: a behaviour opens only under the behaviours path", async ({
	api,
	org,
	pageAs,
}) => {
	const name = `E2E Block Path ${runId()}`;
	const block = await api.as("member").block.create({
		type: "behaviour",
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

	// Its edit page opens its form, and the type's crumb leads to the type's view.
	await open(page, `/app/library/behaviours/${block.data.id}/edit`);
	await expect(
		page.getByRole("button", {
			name: message("blocks_behaviour_form_update_submit_button"),
		}),
	).toBeVisible();
	await page
		.getByRole("link", {
			name: message("library_view_behaviour"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/library\/behaviours$/);

	// The repositories path, Explore, a path that names no type and an id that is no id are not found.
	const notFound = page.getByRole("heading", {
		name: message("boundaries_not_found_title"),
	});
	for (const path of [
		`/app/library/repositories/${block.data.id}`,
		`/app/library/repositories/${block.data.id}/edit`,
		`/app/library/behaviours/${block.data.id}/explore`,
		"/app/library/behaviour",
		"/app/library/behaviours/not-an-id",
	]) {
		await open(page, path);
		await expect(notFound).toBeVisible();
	}
});

test("blocks: a repository opens only under the repositories path, with its edit form and Explore", async ({
	api,
	org,
	pageAs,
}) => {
	const name = `E2E Repository Path ${runId()}`;
	const repository = await api.as("member").block.create({
		type: "repository",
		name,
		status: "ready",
		assets: [],
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	const heading = page.getByRole("heading", {
		name,
	});

	// A direct link and a reload show it under its own type.
	await open(page, `/app/library/repositories/${repository.data.id}`);
	await expect(heading).toBeVisible();
	await page.reload();
	await expect(heading).toBeVisible();

	await open(page, `/app/library/repositories/${repository.data.id}/edit`);
	await expect(
		page.getByRole("button", {
			name: message("blocks_repository_form_update_submit_button"),
		}),
	).toBeVisible();

	await open(page, `/app/library/repositories/${repository.data.id}/explore`);
	await expect(
		page.getByRole("heading", {
			name: message("blocks_explore_heading", {
				name,
			}),
		}),
	).toBeVisible();

	// The behaviours path is not found for it.
	const notFound = page.getByRole("heading", {
		name: message("boundaries_not_found_title"),
	});
	for (const path of [
		`/app/library/behaviours/${repository.data.id}`,
		`/app/library/behaviours/${repository.data.id}/edit`,
	]) {
		await open(page, path);
		await expect(notFound).toBeVisible();
	}
});
