import {
	openAccountPage,
	openAppPage,
	themeToggle,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

test("account: a user switches the theme and the choice survives a reload", async ({
	pageAs,
}) => {
	const page = await pageAs("member");

	await openAccountPage(page);

	const html = page.locator("html");

	// The browser reports the light scheme, and the theme script writes the
	// resolved theme onto the document before React takes over.
	await expect(html).toHaveClass(/light/);

	await themeToggle(page).click();
	await expect(html).toHaveClass(/dark/);

	// The theme lives in local storage of the browser, not with the user.
	await openAccountPage(page);
	await expect(html).toHaveClass(/dark/);

	await themeToggle(page).click();
	await expect(html).toHaveClass(/light/);
});

test("account: skipping the app tour is remembered for the user", async ({
	api,
	appBaseURL,
	browser,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "tour",
		admin: api.as("admin"),
	});
	const { context, page } = await pageForSession(browser, user.session);

	try {
		const tourCard = page.getByText(
			message("next_step_initial_welcome_title"),
			{
				exact: true,
			},
		);

		// A user who has not seen the tour gets it on the app home.
		await openAppPage(page, "/app", tourCard);

		await page
			.getByRole("button", {
				name: message("next_step_card_skip_button"),
			})
			.click();

		// Skipping is silent in the UI, so the card going away is the only signal.
		await expect(tourCard).toHaveCount(0);

		await expect
			.poll(async () => (await user.api.user.me({})).data.preferences?.tours)
			.toEqual({
				initialTour: "skipped",
			});

		// The state is the user's, so the tour stays away on the next load.
		await open(page, "/app");
		await expect(tourCard).toHaveCount(0);
	} finally {
		await context.close();
	}
});
