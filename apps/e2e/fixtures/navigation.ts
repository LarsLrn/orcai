import { expect, type Page } from "@playwright/test";
import { createApiClient } from "./api";

/** Open a page and wait for the network to settle, which covers late hydration. */
export const open = async (page: Page, path: string): Promise<void> => {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
};

/** An oRPC client acting as the page's own session. */
const apiOf = async (page: Page) => {
	const cookies = await page.context().cookies();

	return createApiClient(
		new URL(page.url()).origin,
		cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
	);
};

/** One of the page user's organisations by slug, paging through the list. */
const findOrganisation = async (
	page: Page,
	organisationSlug: string,
): Promise<
	| {
			id: string;
			name: string;
	  }
	| undefined
> => {
	const api = await apiOf(page);

	for (let pageIndex = 0; ; pageIndex += 1) {
		const organisations = await api.organization.list({
			pageIndex,
			pageSize: 100,
			sort: [
				{
					id: "createdAt",
					desc: false,
				},
			],
		});
		const match = organisations.data.find(
			(organisation) => organisation.slug === organisationSlug,
		);

		if (match || organisations.data.length < 100) {
			return match;
		}
	}
};

/** Make an organisation active over the API with the page's own session. */
const activateOverApi = async (
	page: Page,
	organisationSlug: string,
): Promise<boolean> => {
	const match = await findOrganisation(page, organisationSlug);

	if (!match) {
		return false;
	}

	await (await apiOf(page)).user.setActiveOrganization({
		organizationId: match.id,
	});

	return true;
};

/**
 * Skip the initial tour, whose overlay swallows every click. The skip is
 * remembered for the user; the card mounts after idle, hence the bounded wait.
 */
const skipInitialTour = async (page: Page): Promise<void> => {
	const skip = page.getByRole("button", {
		name: "Skip",
	});

	const appeared = await skip
		.waitFor({
			state: "visible",
			timeout: 3_000,
		})
		.then(() => true)
		.catch(() => false);

	if (!appeared) {
		return;
	}

	await skip.click();
	await expect(skip).toHaveCount(0);
};

/** Enter an organisation through the picker, or the API when its card is not listed. */
export const enterApp = async (
	page: Page,
	organisationSlug: string,
): Promise<void> => {
	await page.goto("/en/select-organization");

	const card = page.getByRole("button").filter({
		hasText: `@${organisationSlug}`,
	});
	const heading = page.getByRole("heading", {
		name: "Select your organisation",
	});

	await expect(async () => {
		if (await card.isVisible()) {
			await card.click();
		} else if (
			(await heading.isVisible()) &&
			(await activateOverApi(page, organisationSlug))
		) {
			await page.goto("/en/app");
		}

		await expect(page).toHaveURL(/\/en\/app(\/|$)/, {
			timeout: 5_000,
		});
	}).toPass({
		timeout: 30_000,
	});

	await page.waitForLoadState("networkidle");
	await skipInitialTour(page);

	// Reload through snapshot lag until the user menu names the organisation.
	const organisation = await findOrganisation(page, organisationSlug);

	if (!organisation) {
		return;
	}

	const organisationName = page.getByRole("button", {
		name: organisation.name,
	});

	await expect(async () => {
		if (!(await organisationName.isVisible())) {
			await open(page, "/en/app");
		}

		await expect(organisationName).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 25_000,
	});
};
