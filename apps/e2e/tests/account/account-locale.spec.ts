import { storedLocaleOf } from "../../fixtures/account/locale";
import { openAppPage, switchLocale } from "../../fixtures/account/navigation";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { open } from "../../fixtures/navigation";
import { createMember } from "../../fixtures/users";

/** A translated section title on the app home. */
const WELCOME = {
	en: message("home_try_title"),
	de: message("home_try_title", {}, "de"),
} as const;

test("account: a user switches the interface language to German and back", async ({
	api,
	pageForSession,
}) => {
	const user = await createMember({
		label: "locale",
		admin: api.as("admin"),
	});

	const page = await pageForSession(user.session);

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
});

test("account: a language chosen in the header follows the user into a new browser", async ({
	api,
	appBaseURL,
	newContext,
	pageForSession,
}) => {
	const user = await createMember({
		label: "locale-follow",
		admin: api.as("admin"),
	});

	const first = await pageForSession(user.session);

	await openAppPage(first, "/app", first.getByText(WELCOME.en));

	await switchLocale(first, {
		menuLabel: message("header_locale_switcher_label"),
		item: "Deutsch",
		until: "de",
	});

	// The switcher saves before it reloads, so the choice is already stored.
	expect(await storedLocaleOf(appBaseURL, user.session)).toBe("de");

	// An English browser without any cookie signs in and is handed the stored
	// language.
	const context = await newContext();
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
});
