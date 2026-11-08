import { type InferenceMock, startInferenceMock } from "@orcai/ai/testing";
import {
	type BrowserContext,
	type BrowserContextOptions,
	test as base,
	expect,
	type Page,
	type PlaywrightTestArgs,
	type PlaywrightTestOptions,
	type PlaywrightWorkerArgs,
	type PlaywrightWorkerOptions,
	type TestType,
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
	/** This worker's mock inference server; tests use `inference`, which resets it. */
	inferenceServer: InferenceMock;
};

/** Opens a page signed in as the instance-wide well-known admin. */
export type PageAsWellKnownAdmin = () => Promise<Page>;

export type PageErrors = {
	/** Record the uncaught errors of every page in a context. */
	watch: (context: BrowserContext) => void;
};

type TestFixtures = {
	api: Api;
	/** The newest zedToken this worker's setup and API clients have seen. */
	zedTokens: ZedTokenStore;
	outbox: Outbox;
	pageAs: (role: Role, organisation?: WorkerOrganisation) => Promise<Page>;
	pageAsWellKnownAdmin: PageAsWellKnownAdmin;
	/** Fails the test with every uncaught error its pages logged. */
	pageErrors: PageErrors;
	/** A browser context whose pages fail the test on uncaught errors, closed after the test. */
	newContext: (options?: BrowserContextOptions) => Promise<BrowserContext>;
	/** A page carrying a session captured earlier. */
	pageForSession: (session: Session) => Promise<Page>;
	/** Give an open page the newest zedToken of this test, so its next reads are fresh. */
	seedZedToken: (page: Page) => Promise<void>;
	/** The worker's mock inference server, on an ephemeral port, reset before and after the test. */
	inference: InferenceMock;
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

const extended = base.extend<TestFixtures, WorkerFixtures>({
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

	inferenceServer: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies from this pattern.
		async ({}, use) => {
			const mock = await startInferenceMock();
			await use(mock);
			await mock.close();
		},
		{
			scope: "worker",
		},
	],

	inference: async ({ inferenceServer }, use) => {
		inferenceServer.reset();
		try {
			await use(inferenceServer);
		} finally {
			inferenceServer.reset();
		}
	},

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

	// React reports a hydration mismatch as an uncaught error too.
	// biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies from this pattern.
	pageErrors: async ({}, use) => {
		const errors: string[] = [];

		await use({
			watch: (context) => {
				context.on("weberror", (webError) => {
					const error = webError.error();
					errors.push(
						`${webError.page()?.url() ?? "unknown page"}: ${error.stack ?? error.message}`,
					);
				});
			},
		});

		if (errors.length > 0) {
			throw new Error(`Uncaught page errors:\n\n${errors.join("\n\n")}`);
		}
	},

	context: async ({ context, pageErrors }, use) => {
		pageErrors.watch(context);
		await use(context);
	},

	newContext: async ({ browser, pageErrors }, use) => {
		const contexts: BrowserContext[] = [];

		await use(async (options) => {
			const context = await browser.newContext({
				locale: "en",
				...options,
			});
			contexts.push(context);
			pageErrors.watch(context);

			return context;
		});

		await Promise.all(contexts.map((context) => context.close()));
	},

	pageForSession: async ({ newContext }, use) => {
		await use(async (session) => {
			const context = await newContext({
				storageState: session.storageState,
			});

			return await context.newPage();
		});
	},

	pageAsWellKnownAdmin: async ({ appBaseURL, newContext, zedTokens }, use) => {
		await use(async () => {
			const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
			const context = await newContext({
				storageState: admin.storageState,
			});
			await seedZedToken(context, appBaseURL, zedTokens);

			return await context.newPage();
		});
	},

	pageAs: async ({ appBaseURL, newContext, org, zedTokens }, use) => {
		await use(async (role, organisation = org) => {
			const context = await newContext({
				storageState: organisation.storageStates[role],
			});
			await seedZedToken(context, appBaseURL, zedTokens);

			return await context.newPage();
		});
	},
});

/** Specs open contexts through `newContext` and never reach the browser, so every page is watched for uncaught errors. */
export const test: TestType<
	PlaywrightTestArgs & PlaywrightTestOptions & TestFixtures,
	Omit<PlaywrightWorkerArgs, "browser" | "playwright"> &
		PlaywrightWorkerOptions &
		WorkerFixtures
> = extended;

export type { ApiClient, Role, Session, WorkerOrganisation };
export { expect, signIn, WELL_KNOWN_ADMIN };
