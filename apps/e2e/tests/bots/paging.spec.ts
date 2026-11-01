import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const WRITES = /\/api\/rpc\/(block\/(create|update)|bot\/save)\b/;

/** The block and bot writes the page sends from now on. */
const recordWrites = (page: Page) => {
	const writes: string[] = [];
	page.on("request", (request) => {
		const path = new URL(request.url()).pathname;
		if (WRITES.test(path)) {
			writes.push(path);
		}
	});
	return writes;
};

const next = (page: Page) =>
	page.getByRole("button", {
		name: message("common_next_button"),
	});

test("bots: paging through a published bot writes nothing", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: `E2E Paging Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the paging spec.",
		},
	});
	// A ready bot may link a repository that is still a draft.
	const repository = await member.block.create({
		type: "repository",
		name: `E2E Paging Repository ${runId()}`,
		status: "draft",
		assets: [],
		config: {
			minPassages: 1,
			maxPassages: 5,
			defaultPassages: 3,
		},
	});
	const bot = await member.bot.save({
		name: `E2E Paging Bot ${runId()}`,
		description: "Created by the paging spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [
			repository.data.id,
		],
	});
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.data.id}/setup?step=0`);
	const writes = recordWrites(page);

	for (const step of [
		1,
		2,
		3,
		4,
		5,
	]) {
		await next(page).click();
		await expect(page).toHaveURL(new RegExp(`step=${step}`));
	}

	await expect(
		page.getByRole("button", {
			name: message("authoring_wizard_publish_action"),
		}),
	).toBeVisible();
	expect(writes).toEqual([]);
	await expect(page.getByText(message("bots_save_toast_error"))).toHaveCount(0);
});

test("bots: a step with changes saves once, with one toast", async ({
	api,
	org,
	pageAs,
}) => {
	const member = api.as("member");
	const behaviour = await member.block.create({
		type: "behaviour",
		name: `E2E Paging Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the paging spec.",
		},
	});
	const bot = await member.bot.save({
		name: `E2E Paging Bot ${runId()}`,
		description: "Created by the paging spec.",
		status: "ready",
		behaviourId: behaviour.data.id,
		repositoryIds: [],
	});
	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.data.id}/setup?step=0`);
	const writes = recordWrites(page);

	await page
		.getByLabel(message("authoring_basics_name_label"))
		.fill(`${bot.data.name} renamed`);
	await next(page).click();

	await expect(page).toHaveURL(/step=1/);
	await expect(page.getByText(message("bots_save_toast_success"))).toHaveCount(
		1,
	);
	expect(writes).toEqual([
		"/api/rpc/bot/save",
	]);

	await next(page).click();
	await expect(page).toHaveURL(/step=2/);
	expect(writes).toHaveLength(1);
});
