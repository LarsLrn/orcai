import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

/** Once armed, counts view transitions and holds their updates until the test releases them, so a second navigation lands inside the first. */
const HOLD_VIEW_TRANSITIONS = `(() => {
	const start = document.startViewTransition?.bind(document);
	if (!start) return;
	let release;
	const released = new Promise((resolve) => {
		release = resolve;
	});
	window.__viewTransitionsStarted = 0;
	window.__holdViewTransitions = () => {
		window.__viewTransitionsHeld = true;
	};
	window.__releaseViewTransitions = () => release();
	const hold = (update) => async () => {
		await released;
		await update?.();
	};
	document.startViewTransition = (options) => {
		if (!window.__viewTransitionsHeld) return start(options);
		window.__viewTransitionsStarted += 1;
		return start(
			typeof options === "function"
				? hold(options)
				: { ...options, update: hold(options?.update) },
		);
	};
})();`;

type HeldTransitions = {
	__holdViewTransitions?: () => void;
	__viewTransitionsStarted?: number;
	__releaseViewTransitions?: () => void;
};

test("layout: a navigation inside a running view transition leaves no page error", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("member");
	await page.addInitScript({
		content: HOLD_VIEW_TRANSITIONS,
	});
	await enterApp(page, org.slug);
	const started = () =>
		page.evaluate(
			() => (globalThis as HeldTransitions).__viewTransitionsStarted ?? 0,
		);
	await page.evaluate(() =>
		(globalThis as HeldTransitions).__holdViewTransitions?.(),
	);

	await page
		.getByRole("link", {
			name: message("sidebar_menu_library_item"),
			exact: true,
		})
		.click();
	await expect.poll(started).toBe(1);

	// The second navigation skips the first transition while it still updates.
	await page
		.getByRole("link", {
			name: message("sidebar_menu_catalogue_item"),
			exact: true,
		})
		.dispatchEvent("click");
	await expect.poll(started).toBe(2);
	await page.evaluate(() =>
		(globalThis as HeldTransitions).__releaseViewTransitions?.(),
	);
	await expect(page).toHaveURL(/\/app\/catalogue/);
});
