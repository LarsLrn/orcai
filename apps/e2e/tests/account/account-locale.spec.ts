import { openAppPage, switchLocale } from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { expect, test } from "../../fixtures/index";

/** The two translated sentences the app home greets a user with. */
const WELCOME = {
	en: "Ask questions against your organisation's approved sources, or build a bot that others can use.",
	de: "Stellen Sie Fragen an die freigegebenen Quellen Ihrer Organisation oder erstellen Sie einen Bot, den andere nutzen können.",
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
		await openAppPage(page, "/en/app", page.getByText(WELCOME.en));

		await switchLocale(page, {
			menuLabel: "Language",
			item: "Deutsch",
			until: /\/de\/app(\/|$)/,
		});

		await expect(page.getByText(WELCOME.de)).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("lang", "de");

		// The language is the URL prefix plus a cookie of this browser
		// context, not a preference stored for the user, so nothing outside
		// this context sees it; it is switched back all the same, because
		// every other locator in the suite reads English names.
		await switchLocale(page, {
			menuLabel: "Sprache",
			item: "English",
			until: /\/en\/app(\/|$)/,
		});

		await expect(page.getByText(WELCOME.en)).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("lang", "en");
	} finally {
		await context.close();
	}
});
