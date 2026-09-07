import {
	type BrowserContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";
import { type ApiClient, createApiClient } from "./api";
import { type Session, signIn } from "./auth";
import { type Role, WELL_KNOWN_ADMIN } from "./constants";
import { baseURL } from "./env";
import {
	adminSession,
	createWorkerOrganisation,
	runId,
	type WorkerOrganisation,
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
	outbox: Outbox;
	pageAs: (role: Role, organisation?: WorkerOrganisation) => Promise<Page>;
	pageAsWellKnownAdmin: PageAsWellKnownAdmin;
};

const slugify = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

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

	api: async ({ appBaseURL, org }, use) => {
		const admin = await adminSession(appBaseURL);

		await use({
			as: (role, organisation = org) =>
				createApiClient(appBaseURL, organisation.cookieHeaders[role]),
			asWellKnownAdmin: () => createApiClient(appBaseURL, admin.cookieHeader),
		});
	},

	outbox: {
		latestFor,
	},

	pageAsWellKnownAdmin: async ({ appBaseURL, browser }, use) => {
		const contexts: BrowserContext[] = [];

		await use(async () => {
			const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
			const context = await browser.newContext({
				storageState: admin.storageState,
				locale: "en",
			});
			contexts.push(context);

			return await context.newPage();
		});

		await Promise.all(contexts.map((context) => context.close()));
	},

	pageAs: async ({ browser, org }, use) => {
		const contexts: BrowserContext[] = [];

		await use(async (role, organisation = org) => {
			const context = await browser.newContext({
				storageState: organisation.storageStates[role],
				locale: "en",
			});
			contexts.push(context);

			return await context.newPage();
		});

		await Promise.all(contexts.map((context) => context.close()));
	},
});

export type { ApiClient, Role, Session, WorkerOrganisation };
export { expect, signIn, WELL_KNOWN_ADMIN };
