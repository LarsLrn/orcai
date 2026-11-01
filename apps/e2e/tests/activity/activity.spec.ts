import type { Page } from "@playwright/test";
import { uploadTogether } from "../../fixtures/activity/uploads";
import { uploadAsset } from "../../fixtures/assets";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

/*
 * No workers run here, so an upload's preparation cannot be queued and the
 * upload ends failed at once: a failed entry and a failure that needs the
 * user. Each test uses a fresh organisation, so its users have no other
 * activity.
 */

const trigger = (page: Page) =>
	page.getByRole("button", {
		name: /^Activity/,
	});

const panel = (page: Page) =>
	page.getByRole("dialog", {
		name: message("activity_title"),
	});

const failureTitle = (name: string) =>
	message("activity_failure_processing_title", {
		asset: name,
	});

const uploadTitle = message("activity_run_upload_library_title");

test("activity: an idle user gets the empty list from the keyboard", async ({
	api,
	orgs,
	pageAs,
}) => {
	const created = await orgs.create(`E2E Activity Idle ${runId()}`);
	await api.as("member", created).user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const page = await pageAs("member", created);
	await enterApp(page, created.slug);
	await open(page, "/app/library");

	await expect(trigger(page)).toHaveAccessibleName(message("activity_title"));
	await trigger(page).focus();
	await page.keyboard.press("Enter");
	await expect(
		panel(page).getByText(message("activity_empty_title")),
	).toBeVisible();
	await expect(
		panel(page).getByText(message("activity_empty_description")),
	).toBeVisible();

	await page.keyboard.press("Escape");
	await expect(panel(page)).toHaveCount(0);
	await expect(trigger(page)).toBeFocused();
});

// The e2e package has no DOM lib; these are the browser members the check reads.
type Measured = {
	getBoundingClientRect(): {
		top: number;
	};
};
type Viewport = {
	scrollY: number;
	scrollTo(x: number, y: number): void;
};

test("activity: the list stays below its trigger when the page scrolls under it", async ({
	api,
	orgs,
	pageAs,
}) => {
	const created = await orgs.create(`E2E Activity Scroll ${runId()}`);
	await api.as("member", created).user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const page = await pageAs("member", created);
	// Short enough for the Library to scroll, wide enough for the popover.
	await page.setViewportSize({
		width: 900,
		height: 560,
	});
	await enterApp(page, created.slug);
	await open(page, "/app/library");
	await trigger(page).click();

	const title = panel(page).getByText(message("activity_empty_title"));
	await expect(title).toBeVisible();

	// The trigger sits in the sticky header, so a page scroll (a test runner
	// scrolling a target into view) must not move the list, not even for the
	// frame before it is positioned again. Read synchronously.
	const { scrolled, shift } = await title.evaluate((element) => {
		const target = element as unknown as Measured;
		const view = globalThis as unknown as Viewport;
		const before = target.getBoundingClientRect().top;

		view.scrollTo(0, 200);

		return {
			scrolled: view.scrollY,
			shift: target.getBoundingClientRect().top - before,
		};
	});

	expect(scrolled).toBeGreaterThan(0);
	expect(shift).toBe(0);
});

test("activity: a failed upload needs attention until dismissed, and its entry opens its assets in the Library", async ({
	api,
	orgs,
	pageAs,
}) => {
	test.slow();

	const created = await orgs.create(`E2E Activity Failed ${runId()}`);
	const member = api.as("member", created);
	await member.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const name = `E2E Activity ${runId()}.txt`;
	const other = `E2E Activity Other ${runId()}.txt`;
	await uploadTogether(member, [
		name,
		other,
	]);

	const page = await pageAs("member", created);
	await enterApp(page, created.slug);
	await open(page, "/app/library");

	await expect(trigger(page)).toHaveAccessibleName(
		"Activity, 2 need your attention",
	);
	await trigger(page).click();

	const failure = panel(page).getByRole("link", {
		name: failureTitle(name),
	});
	await expect(failure).toBeVisible();
	await expect(
		panel(page).getByRole("heading", {
			name: message("activity_attention_section"),
		}),
	).toBeVisible();
	await expect(
		panel(page).getByText(
			`${message("activity_run_state_failed")} · 2 of 2 failed · ${created.name}`,
			{
				exact: true,
			},
		),
	).toBeVisible();

	// Tab reaches the failure's link and its dismiss button.
	await expect(async () => {
		await page.keyboard.press("Tab");
		await expect(failure).toBeFocused({
			timeout: 500,
		});
	}).toPass();
	await page.keyboard.press("Tab");
	await expect(
		panel(page).getByRole("button", {
			name: message("activity_dismiss_label", {
				title: failureTitle(name),
			}),
		}),
	).toBeFocused();

	const details = panel(page).getByRole("button", {
		name: message("activity_run_details_show", {
			title: uploadTitle,
		}),
	});
	await details.click();
	await expect(
		panel(page).getByRole("button", {
			name: message("activity_run_details_hide", {
				title: uploadTitle,
			}),
		}),
	).toHaveAttribute("aria-expanded", "true");
	await expect(
		panel(page)
			.getByRole("listitem")
			.filter({
				has: page.getByRole("link", {
					name,
					exact: true,
				}),
				hasNotText: uploadTitle,
			}),
	).toContainText(message("asset_state_failed_label"));

	await panel(page)
		.getByRole("link", {
			name: message("activity_run_show_in_library"),
		})
		.click();
	await expect(panel(page)).toHaveCount(0);
	await expect(page).toHaveURL(/\/app\/library\/assets\?.*run=/);
	await expect(
		page.getByText(
			message("activity_library_run_filter", {
				title: uploadTitle,
			}),
		),
	).toBeVisible();
	await expect(
		page.getByText(name, {
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("link", {
			name: message("activity_library_run_filter_clear"),
		})
		.click();
	await expect(page).not.toHaveURL(/run=/);

	await trigger(page).click();
	await panel(page)
		.getByRole("button", {
			name: message("activity_dismiss_label", {
				title: failureTitle(name),
			}),
		})
		.click();
	await expect(failure).toHaveCount(0);
	await expect(trigger(page)).toHaveAccessibleName(
		"Activity, 1 needs your attention",
	);
	// Focus stays in the list instead of falling back to the page.
	await expect(panel(page).locator(":focus")).toHaveCount(1);

	await panel(page)
		.getByRole("button", {
			name: message("activity_dismiss_label", {
				title: uploadTitle,
			}),
		})
		.click();
	await expect(
		panel(page).getByRole("heading", {
			name: message("activity_recent_section"),
		}),
	).toHaveCount(0);
	await expect(
		panel(page).getByRole("link", {
			name: failureTitle(other),
		}),
	).toBeVisible();
});

test("activity: the dashboard card shows only while something needs the user, and opens the list", async ({
	api,
	orgs,
	pageAs,
	seedZedToken,
}) => {
	const created = await orgs.create(`E2E Activity Card ${runId()}`);
	const member = api.as("member", created);
	await member.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const page = await pageAs("member", created);
	await enterApp(page, created.slug);
	await open(page, "/app?view=use");

	const card = page.getByRole("region", {
		name: message("activity_title"),
	});
	await expect(
		page.getByRole("complementary", {
			name: message("organization_profile_active_badge"),
		}),
	).toBeVisible();
	await expect(card).toHaveCount(0);

	await uploadAsset(member, `E2E Activity Card ${runId()}.txt`);
	await seedZedToken(page);
	await page.reload();
	await card
		.getByRole("button", {
			name: "1 failure",
		})
		.click();
	await expect(panel(page)).toBeVisible();
});

test("activity: below md the list opens in a drawer", async ({
	api,
	orgs,
	pageAs,
}) => {
	const created = await orgs.create(`E2E Activity Mobile ${runId()}`);
	const member = api.as("member", created);
	await member.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const name = `E2E Activity Mobile ${runId()}.txt`;
	await uploadAsset(member, name);

	const page = await pageAs("member", created);
	await enterApp(page, created.slug);
	await page.setViewportSize({
		width: 390,
		height: 844,
	});
	await open(page, "/app/library");

	await trigger(page).click();
	await expect(
		panel(page).getByRole("link", {
			name: failureTitle(name),
		}),
	).toBeVisible();
	const box = await panel(page).boundingBox();
	expect(box?.width).toBeLessThanOrEqual(390);
	await page.keyboard.press("Escape");
	await expect(panel(page)).toHaveCount(0);
});
