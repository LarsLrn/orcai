import { expect, type Locator, type Page } from "@playwright/test";
import { message } from "../messages";
import { awaitHydration, open } from "../navigation";

/** Where the account page lives. */
export const accountPath = "/app/account";

/** Open a page under `/app` and wait for the marker that says it rendered. */
export const openAppPage = async (
	page: Page,
	path: string,
	visible: Locator,
): Promise<void> => {
	await open(page, path);
	await expect(visible).toBeVisible();
};

/** Open the account page and wait for its title. */
export const openAccountPage = async (page: Page): Promise<void> => {
	await openAppPage(
		page,
		accountPath,
		page.getByRole("heading", {
			name: message("account_page_title"),
		}),
	);
};

/** The card whose title is `title`; card titles are `div`s, not headings. */
export const accountCard = (page: Page, title: string): Locator =>
	page
		.getByText(title, {
			exact: true,
		})
		.locator('xpath=ancestor::div[@data-slot="card"][1]');

/** The sidebar user menu button, which names the signed-in user. */
export const userMenu = (page: Page, name: string): Locator =>
	page.getByRole("button", {
		name: new RegExp(name),
	});

/** The header's language switcher, named after its label in the current language. */
export const localeSwitcher = (page: Page, label: string): Locator =>
	page.getByRole("button", {
		name: label,
		exact: true,
	});

/** The header's theme toggle, whose accessible name says what it does. */
export const themeToggle = (page: Page): Locator =>
	page.getByRole("button", {
		name: message("header_theme_switcher_label"),
	});

/** Pick a language from the header's switcher and wait for the reloaded page to hydrate in it. */
export const switchLocale = async (
	page: Page,
	params: {
		/** The switcher's own label, in the language in force before the switch. */
		menuLabel: string;
		/** The language to pick, named as the switcher names it. */
		item: string;
		/** The `lang` attribute the document has to end up with. */
		until: "en" | "de";
	},
): Promise<void> => {
	await localeSwitcher(page, params.menuLabel).click();
	// The trigger carries the same label, so look inside the open menu.
	await expect(
		page.getByRole("menu").getByText(params.menuLabel, {
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("menuitem", {
			name: params.item,
		})
		.click();
	await expect(page.locator("html")).toHaveAttribute("lang", params.until, {
		timeout: 10_000,
	});
	await awaitHydration(page);
};
