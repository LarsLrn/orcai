import { openAccountPage, userMenu } from "../../fixtures/account/navigation";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";

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

	await openAccountPage(page);
	await userMenu(page, "E2E member").click();

	const item = page.getByRole("menuitem", {
		name: message("user_menu_account_item"),
	});

	await expect(item).toBeVisible();

	// The trigger sits in the fixed sidebar, so a page scroll (a tour ending,
	// a test runner scrolling a target into view) must not move the menu, not
	// even for the frame before it is positioned again. Read synchronously.
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
