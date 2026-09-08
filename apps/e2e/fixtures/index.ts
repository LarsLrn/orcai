import {
	type BrowserContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";
import {
	type ApiClient,
	createApiClient,
	ZED_TOKEN_COOKIE,
	type ZedTokenStore,
} from "./api";
import { type Session, signIn } from "./auth";
import { type Role, WELL_KNOWN_ADMIN } from "./constants";
import { baseURL } from "./env";
import {
	adminSession,
	createWorkerOrganisation,
	runId,
	type WorkerOrganisation,
	workerZedTokens,
} from "./organisation";
import { latestFor, type Outbox } from "./outbox";

export type Api = {
	/** Client signed in as a role of a worker organisation. */
	as: (role: Role, organisation?: WorkerOrganisation) => ApiClient;
	/** Client signed in as the instance-wide well-known admin. */
	asWellKnownAdmin: () => ApiClient;
};

export type Organisations = {
	/** An additional organisation owned by this worker, for seam tests. */
	create: (name: string, slug?: string) => Promise<WorkerOrganisation>;
};

type WorkerFixtures = {
	appBaseURL: string;
	org: WorkerOrganisation;
	orgs: Organisations;
};

/** Opens a page signed in as the instance-wide well-known admin. */
export type PageAsWellKnownAdmin = () => Promise<Page>;

type TestFixtures = {
	api: Api;
	/** The newest zedToken this worker's setup and API clients have seen. */
	zedTokens: ZedTokenStore;
	outbox: Outbox;
	pageAs: (role: Role, organisation?: WorkerOrganisation) => Promise<Page>;
	pageAsWellKnownAdmin: PageAsWellKnownAdmin;
	/** Give an open page the newest zedToken of this test, so its next reads are fresh. */
	seedZedToken: (page: Page) => Promise<void>;
};

const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

/** Carry the API setup's revision into the browser, so its first load is fresh. */
const seedZedToken = async (
	context: BrowserContext,
	appBaseURL: string,
	zedTokens: ZedTokenStore,
): Promise<void> => {
	const zedToken = zedTokens.read();

	if (!zedToken) return;

	await context.addCookies([
		{
			name: ZED_TOKEN_COOKIE,
			value: zedToken,
			url: appBaseURL,
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
	appBaseURL: [
		baseURL(),
		{
			scope: "worker",
			option: true,
		},
	],

	orgs: [
		async ({ appBaseURL }, use, workerInfo) => {
			const prefix = `e2e-w${String(workerInfo.workerIndex)}`;

			await use({
				create: async (name, slug) =>
					await createWorkerOrganisation({
						baseURL: appBaseURL,
						admin: await adminSession(appBaseURL),
						name,
						slug: slug ?? `${prefix}-${slugify(name)}-${runId()}`,
					}),
			});
		},
		{
			scope: "worker",
		},
	],

	org: [
		async ({ orgs }, use, workerInfo) => {
			const index = String(workerInfo.workerIndex);

			await use(
				await orgs.create(`E2E Worker ${index}`, `e2e-w${index}-${runId()}`),
			);
		},
		{
			scope: "worker",
		},
	],

	// biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies from this pattern.
	zedTokens: async ({}, use) => {
		await use(workerZedTokens);
	},

	api: async ({ appBaseURL, org, zedTokens }, use) => {
		const admin = await adminSession(appBaseURL);
		// One client per session for the test, so a sequence of calls shares the
		// zedToken memory instead of starting stale again.
		const clients = new Map<string, ApiClient>();
		const client = (key: string, cookieHeader: string) => {
			const existing = clients.get(key);

			if (existing) return existing;

			const created = createApiClient(appBaseURL, cookieHeader, zedTokens);
			clients.set(key, created);

			return created;
		};

		await use({
			as: (role, organisation = org) =>
				client(
					`${organisation.slug}:${role}`,
					organisation.cookieHeaders[role],
				),
			asWellKnownAdmin: () => client("well-known-admin", admin.cookieHeader),
		});
	},

	outbox: {
		latestFor,
	},

	seedZedToken: async ({ appBaseURL, zedTokens }, use) => {
		await use((page) => seedZedToken(page.context(), appBaseURL, zedTokens));
	},

	pageAsWellKnownAdmin: async ({ appBaseURL, browser, zedTokens }, use) => {
		const contexts: BrowserContext[] = [];

		await use(async () => {
			const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
			const context = await browser.newContext({
				storageState: admin.storageState,
				locale: "en",
			});
			contexts.push(context);
			await seedZedToken(context, appBaseURL, zedTokens);

			return await context.newPage();
		});

		await Promise.all(contexts.map((context) => context.close()));
	},

	pageAs: async ({ appBaseURL, browser, org, zedTokens }, use) => {
		const contexts: BrowserContext[] = [];

		await use(async (role, organisation = org) => {
			const context = await browser.newContext({
				storageState: organisation.storageStates[role],
				locale: "en",
			});
			contexts.push(context);
			await seedZedToken(context, appBaseURL, zedTokens);

			return await context.newPage();
		});

		await Promise.all(contexts.map((context) => context.close()));
	},
});

export type { ApiClient, Role, Session, WorkerOrganisation };
export { expect, signIn, WELL_KNOWN_ADMIN };
