import type { Locator } from "@playwright/test";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test.describe.configure({
	mode: "serial",
});

const PHONE = {
	width: 390,
	height: 844,
};

const longName = (id: string) =>
	`E2E${"Forschungsmethodenberatungsassistenz".repeat(2)}${id}`;

const expectInsideViewport = async (locator: Locator) => {
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(PHONE.width);
};

// The catalogue teaser shows the newest entry of the whole instance, so it runs alone.
test("home: long bot and catalogue names wrap inside a phone screen", async ({
	api,
	orgs,
	pageAs,
}) => {
	const created = await orgs.create(`E2E Home Phone ${runId()}`);
	const admin = api.as("admin", created);
	// The initial tour's modal would cover the dashboard.
	await admin.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const botNames = [
		longName(runId()),
		longName(runId()),
	];
	for (const name of botNames) {
		await admin.bot.save({
			name,
			description: "Created by the home phone spec.",
			status: "ready",
			templateBlockId: null,
			databaseBlockIds: [],
		});
	}

	const source = await orgs.create(`E2E Home Phone Source ${runId()}`);
	const author = api.as("admin", source);
	const entryName = longName(runId());
	const { data: behaviour } = await author.block.create({
		type: "template",
		name: entryName,
		status: "ready",
		config: {
			systemPrompt: "Created by the home phone spec.",
		},
	});
	await author.resource.setVisibility({
		resourceType: "block",
		resourceId: behaviour.id,
		visibility: "public",
		listBlockIds: [],
	});

	const page = await pageAs("admin", created);
	await enterApp(page, created.slug);
	await page.setViewportSize(PHONE);
	// A fresh organisation's admin lands on the setup checklist otherwise.
	await open(page, "/app?view=use");

	for (const name of botNames) {
		const link = page.getByRole("link", {
			name,
		});
		await expect(link).toBeVisible();
		await expectInsideViewport(link);
	}
	const teaser = page.getByRole("link", {
		name: message("home_try_catalogue_new", {
			name: entryName,
		}),
	});
	await expect(teaser).toBeVisible();
	await expectInsideViewport(
		teaser.getByText(
			message("home_try_catalogue_new", {
				name: entryName,
			}),
		),
	);
});
