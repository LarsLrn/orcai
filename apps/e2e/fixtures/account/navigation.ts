import { expect, type Locator, type Page } from "@playwright/test";
import { open } from "../navigation";

/** Where the account page lives, per locale prefix. */
export const accountPath = (locale: "en" | "de" = "en"): string =>
	`/${locale}/app/account`;

/** Open a page under `/app`, retrying the navigation through snapshot lag until the marker shows. */
export const openAppPage = async (
	page: Page,
	path: string,
	visible: Locator,
): Promise<void> => {
	await expect(async () => {
		await open(page, path);
		await expect(visible).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 30_000,
	});
};

/** Open the account page and wait for its title. */
export const openAccountPage = async (
	page: Page,
	locale: "en" | "de" = "en",
): Promise<void> => {
	await openAppPage(
		page,
		accountPath(locale),
		page.getByRole("heading", {
			name: "Account",
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
		name: "Toggle theme",
	});

/** Pick a language from the header's switcher, retrying late hydration until the localized path loads. */
export const switchLocale = async (
	page: Page,
	params: {
		/** The switcher's own label, in the language in force before the switch. */
		menuLabel: string;
		/** The language to pick, named as the switcher names it. */
		item: string;
		/** The path the switch has to land on. */
		until: RegExp;
	},
): Promise<void> => {
	await expect(async () => {
		await localeSwitcher(page, params.menuLabel).click();
		// The trigger carries the same label, so look inside the open menu.
		await expect(
			page.getByRole("menu").getByText(params.menuLabel, {
				exact: true,
			}),
		).toBeVisible({
			timeout: 3_000,
		});
		await page
			.getByRole("menuitem", {
				name: params.item,
			})
			.click();
		await expect(page).toHaveURL(params.until, {
			timeout: 10_000,
		});
	}).toPass({
		timeout: 30_000,
	});
};
