import { openAppPage, switchLocale } from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";

/** The translated sentence the app home greets a user with. */
const WELCOME = {
	en: message("home_intro"),
	de: message("home_intro", {}, "de"),
} as const;

test("account: a user switches the interface language to German and back", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "locale",
		admin: api.as("admin"),
		organisation: org,
	});

	// The app home starts the initial tour for a user who has not seen it, and
	// its card covers the header the switcher sits in.
	await user.api.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAppPage(page, "/app", page.getByText(WELCOME.en));

		await switchLocale(page, {
			menuLabel: message("header_locale_switcher_label"),
			item: "Deutsch",
			until: "de",
		});

		await expect(page.getByText(WELCOME.de)).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("lang", "de");

		// The language is a cookie of this browser context, not a preference
		// stored for the user, so nothing outside this context sees it; it is
		// switched back all the same, because every other locator in the suite
		// reads English names.
		await switchLocale(page, {
			menuLabel: message("header_locale_switcher_label", {}, "de"),
			item: "English",
			until: "en",
		});

		await expect(page.getByText(WELCOME.en)).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
	} finally {
		await context.close();
	}
});
