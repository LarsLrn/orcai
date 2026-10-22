import { openAccountPage, userMenu } from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

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

test("account: the user menu stays beside its trigger when the page scrolls under it", async ({
	pageAs,
}) => {
	const page = await pageAs("member");

	// Short enough for the profile tab to scroll, wide enough for the sidebar.
	await page.setViewportSize({
		width: 900,
		height: 560,
	});
	await openAccountPage(page);
	await userMenu(page, "E2E member").click();

	const item = page.getByRole("menuitem", {
		name: message("user_menu_account_item"),
	});

	await expect(item).toBeVisible();

	// The trigger sits in the fixed sidebar, so a page scroll (a test runner
	// scrolling a target into view) must not move the menu, not even for the
	// frame before it is positioned again. Read synchronously.
	const { scrolled, shift } = await item.evaluate((element) => {
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

test("account: Enter on a breadcrumb menu entry navigates to it", async ({
	pageAs,
}) => {
	const page = await pageAs("member");

	// The trail collapses into a menu below the lg breakpoint.
	await page.setViewportSize({
		width: 800,
		height: 720,
	});
	await open(page, "/app/hub/bots");
	await page
		.getByRole("button", {
			name: message("header_breadcrumb_menu_label"),
		})
		.click();

	const entry = page.getByRole("menuitem", {
		name: message("hub_page_title"),
	});

	await expect(entry).toBeVisible();
	await entry.focus();
	await page.keyboard.press("Enter");

	await expect(page).toHaveURL(/\/app\/hub$/);
	await expect(entry).toBeHidden();
});
