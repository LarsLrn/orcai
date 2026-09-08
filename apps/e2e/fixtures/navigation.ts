import { expect, type Page } from "@playwright/test";
import {
	type ApiClient,
	createApiClient,
	createZedTokenStore,
	ZED_TOKEN_COOKIE,
	type ZedTokenStore,
	zedTokenOf,
} from "./api";

/** Open a page and wait for the network to settle, which covers late hydration. */
export const open = async (page: Page, path: string): Promise<void> => {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
};

const zedTokensByPage = new WeakMap<Page, ZedTokenStore>();

/**
 * An oRPC client acting as the page's own session. It forwards every cookie,
 * including `zed_token`, and shares one zedToken memory per page.
 */
const apiOf = async (page: Page) => {
	const cookies = await page.context().cookies();
	let zedTokens = zedTokensByPage.get(page);

	if (!zedTokens) {
		zedTokens = createZedTokenStore();
		zedTokensByPage.set(page, zedTokens);
	}

	return createApiClient(
		new URL(page.url()).origin,
		cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
		zedTokens,
	);
};

/** Give the page the newest zedToken its client saw, so its next load is fresh. */
const mirrorZedToken = async (page: Page, api: ApiClient): Promise<void> => {
	const zedToken = zedTokenOf(api);

	if (!zedToken) return;

	await page.context().addCookies([
		{
			name: ZED_TOKEN_COOKIE,
			value: zedToken,
			url: new URL(page.url()).origin,
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
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
			await mirrorZedToken(page, api);

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

	const api = await apiOf(page);

	await api.user.setActiveOrganization({
		organizationId: match.id,
	});
	await mirrorZedToken(page, api);

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

	// The card appears once the sign-up hook's membership is visible, which no
	// response announces, so the picker is retried.
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

	// The membership the sign-up hook granted announces itself in no response, so
	// both the listing and the user menu are retried until they name it.
	await expect(async () => {
		const organisation = await findOrganisation(page, organisationSlug);

		if (!organisation) {
			await open(page, "/en/app");
			throw new Error(`"${organisationSlug}" is not listed for this user yet.`);
		}

		const organisationName = page.getByRole("button", {
			name: organisation.name,
		});

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
