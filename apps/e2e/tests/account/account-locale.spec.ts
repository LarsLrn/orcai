import { storedLocaleOf } from "../../fixtures/account/locale";
import { openAppPage, switchLocale } from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";

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

		// A signed-in switch is stored for the user as well, so switching back
		// restores both the cookie and the stored preference.
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

test("account: a language chosen in the header follows the user into a new browser", async ({
	api,
	appBaseURL,
	browser,
	org,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "locale-follow",
		admin: api.as("admin"),
		organisation: org,
	});

	// The tour card would cover the header the switcher sits in.
	await user.api.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});

	const first = await pageForSession(browser, user.session);

	try {
		await openAppPage(first.page, "/app", first.page.getByText(WELCOME.en));

		await switchLocale(first.page, {
			menuLabel: message("header_locale_switcher_label"),
			item: "Deutsch",
			until: "de",
		});
	} finally {
		await first.context.close();
	}

	// The switcher saves before it reloads, so the choice is already stored.
	expect(await storedLocaleOf(appBaseURL, user.session)).toBe("de");

	// An English browser without any cookie signs in and is handed the stored
	// language.
	const context = await browser.newContext({
		locale: "en",
	});

	try {
		const page = await context.newPage();

		await open(page, "/login");
		await expect(page.locator("html")).toHaveAttribute("lang", "en");

		await submitForm(page, {
			fill: async () => {
				await page.getByLabel(message("common_email_label")).fill(user.email);
				await page
					.getByLabel(message("common_password_label"), {
						exact: true,
					})
					.fill(user.password);
			},
			submit: message("auth_signin_form_submit_button"),
			until: /\/app(\/|$)/,
		});

		await expect(page.locator("html")).toHaveAttribute("lang", "de");
		await expect(page.getByText(WELCOME.de)).toBeVisible();

		const cookie = (await context.cookies()).find(
			(candidate) => candidate.name === "PARAGLIDE_LOCALE",
		);
		expect(cookie?.value).toBe("de");
		// The client runtime reads the cookie, so it must not be HTTP-only.
		expect(cookie?.httpOnly).toBe(false);
	} finally {
		await context.close();
	}
});
