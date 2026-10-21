import { expect, type Page } from "@playwright/test";
import {
	type ApiClient,
	createApiClient,
	createZedTokenStore,
	ZED_TOKEN_COOKIE,
	type ZedTokenStore,
	zedTokenOf,
} from "./api";
import { message } from "./messages";

/**
 * What keeps the page from being hydrated, or null once nothing does. Reads
 * React internals: the `__reactContainer$` key on the document leads to the
 * committed fiber tree, where a Suspense boundary holds state while it is
 * dehydrated (`<!--$-->` waiting, `<!--$?-->` still streaming, `<!--$!-->`
 * failed on the server) or showing its fallback.
 */
const hydrationGap = (): string | null => {
	type Node = {
		nodeType: number;
		data?: string;
		localName?: string;
		textContent: string | null;
		getAttribute?: (name: string) => string | null;
		nextSibling: Node | null;
	};
	type Fiber = {
		tag: number;
		stateNode: Node | null;
		memoizedState: {
			dehydrated?: Node | null;
		} | null;
		child: Fiber | null;
		sibling: Fiber | null;
	};

	const document = (
		globalThis as unknown as {
			document: Record<
				string,
				| {
						stateNode: {
							current: Fiber;
						};
				  }
				| undefined
			>;
		}
	).document;
	const container = Object.keys(document).find((key) =>
		key.startsWith("__reactContainer$"),
	);
	const root = container ? document[container]?.stateNode.current : undefined;

	if (!root?.child) {
		return "React has not committed the shell";
	}

	const describe = (element: Node | null | undefined) => {
		if (!element?.getAttribute) return "nothing rendered";

		const attributes = [
			"id",
			"data-slot",
			"role",
			"aria-label",
		]
			.map((name) => [
				name,
				element.getAttribute?.(name),
			])
			.filter(([, value]) => value)
			.map(([name, value]) => ` ${name}="${value}"`)
			.join("");
		const text = element.textContent?.trim().slice(0, 80);

		return `<${element.localName}${attributes}>${text ? ` "${text}"` : ""}`;
	};
	const firstElement = (fiber: Fiber | null): Node | null => {
		for (let child = fiber; child; child = child.sibling) {
			const element =
				child.tag === 5 ? child.stateNode : firstElement(child.child);

			if (element) return element;
		}

		return null;
	};
	const fibers: Fiber[] = [
		root.child,
	];

	for (let fiber = fibers.pop(); fiber; fiber = fibers.pop()) {
		const dehydrated = fiber.memoizedState?.dehydrated;

		if ((fiber.tag === 13 || fiber.tag === 31) && dehydrated) {
			let element = dehydrated.nextSibling;

			while (element && element.nodeType !== 1) element = element.nextSibling;

			return `boundary <!--${dehydrated.data}--> is not hydrated: ${describe(element)}`;
		}

		if (fiber.tag === 13 && fiber.memoizedState) {
			return `boundary shows its fallback: ${describe(firstElement(fiber.child?.sibling ?? null))}`;
		}

		if (fiber.sibling) fibers.push(fiber.sibling);
		if (fiber.child) fibers.push(fiber.child);
	}

	return null;
};

/**
 * Wait until React has hydrated the whole page, so clicks, fills and scroll
 * listeners register. React hydrates each Suspense boundary in its own
 * time-sliced pass after the shell and has no public signal for the last one,
 * so this polls the committed tree, then lets one posted-message task run,
 * which is where React's scheduler flushes the commit's passive effects.
 */
export const awaitHydration = async (page: Page): Promise<void> => {
	await expect(async () => {
		expect(await page.evaluate(hydrationGap), "page hydrated").toBeNull();
	}).toPass({
		timeout: 15_000,
		intervals: [
			50,
		],
	});
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				const channel = new MessageChannel();

				channel.port1.onmessage = () => resolve();
				channel.port2.postMessage(null);
			}),
	);
};

/** Open a page and wait for it to hydrate. */
export const open = async (page: Page, path: string): Promise<void> => {
	await page.goto(path);
	await awaitHydration(page);
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
 * Skip the initial tour, whose modal card blocks the page. The skip is
 * remembered for the user; the card opens once the user's preferences have
 * loaded, hence the bounded wait.
 */
const skipInitialTour = async (page: Page): Promise<void> => {
	const skip = page.getByRole("button", {
		name: message("tour_card_skip_button"),
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
	await open(page, "/select-organization");

	const card = page.getByRole("button").filter({
		hasText: `@${organisationSlug}`,
	});
	const heading = page.getByRole("heading", {
		name: message("select_organisation_page_title"),
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
			await open(page, "/app");
		}

		await expect(page).toHaveURL(/\/app(\/|$)/, {
			timeout: 5_000,
		});
	}).toPass({
		timeout: 30_000,
	});

	await awaitHydration(page);
	await skipInitialTour(page);

	// The membership the sign-up hook granted announces itself in no response, so
	// both the listing and the user menu are retried until they name it.
	await expect(async () => {
		const organisation = await findOrganisation(page, organisationSlug);

		if (!organisation) {
			await open(page, "/app");
			throw new Error(`"${organisationSlug}" is not listed for this user yet.`);
		}

		const organisationName = page.getByRole("button", {
			name: organisation.name,
		});

		if (!(await organisationName.isVisible())) {
			await open(page, "/app");
		}

		await expect(organisationName).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 25_000,
	});
};
