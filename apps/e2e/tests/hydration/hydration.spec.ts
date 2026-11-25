import type {
	BrowserContext,
	BrowserContextOptions,
	Page,
} from "@playwright/test";
import { uploadTogether } from "../../fixtures/activity/uploads";
import { createApiClient } from "../../fixtures/api";
import { createBot } from "../../fixtures/assistant/approval";
import {
	createMockModel,
	setAssistantModel,
	startConversation,
} from "../../fixtures/assistant/assistant";
import { untilAllowed } from "../../fixtures/authorization";
import {
	authzName,
	behaviourInput,
	botSave,
} from "../../fixtures/authz/resources";
import {
	chatName,
	createChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { serverHtml } from "../../fixtures/hydration/server-html";
import {
	type ApiClient,
	expect,
	signIn,
	test,
	WELL_KNOWN_ADMIN,
	type WorkerOrganisation,
} from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import { addMember, createUser } from "../../fixtures/users";

// A date written in UTC instead of the browser's zone reads differently: each
// test opens its page in a zone where its date falls on another day than in UTC.
const AHEAD = "Pacific/Kiritimati";
const BEHIND = "Etc/GMT+12";

test.use({
	timezoneId: AHEAD,
});

const dateOf = (value: Date | string | null | undefined) => {
	if (!value) throw new Error("No date to show");
	return new Date(value);
};

/** 14 hours ahead from 10:00 UTC, 12 hours behind before. */
const zoneAcrossTheDateLine = (at: Date) =>
	at.getUTCHours() >= 10 ? AHEAD : BEHIND;

/** A date as the app writes it in English in `timeZone`. */
const inZone = (at: Date, style: "date" | "datetime", timeZone: string) =>
	new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: style === "datetime" ? "short" : undefined,
		timeZone,
	}).format(at);

/** A page and the date of what the test created that it shows. */
type Shown = {
	path: string;
	at: Date;
	style: "date" | "datetime";
};

type ContextFixtures = {
	appBaseURL: string;
	newContext: (options?: BrowserContextOptions) => Promise<BrowserContext>;
	seedZedToken: (page: Page) => Promise<void>;
};

/**
 * A page in the zone across the date line from `at`, carrying the cookie the
 * app sets after a page loads, so the next load renders in the zone.
 */
const pageInZone = async (
	{ appBaseURL, newContext, seedZedToken }: ContextFixtures,
	storageState: BrowserContextOptions["storageState"],
	at: Date,
) => {
	const timeZone = zoneAcrossTheDateLine(at);
	const context = await newContext({
		storageState,
		timezoneId: timeZone,
	});
	await context.addCookies([
		{
			name: "time_zone",
			value: timeZone,
			url: appBaseURL,
			sameSite: "Lax",
		},
	]);
	const page = await context.newPage();
	await seedZedToken(page);
	return {
		page,
		timeZone,
	};
};

/** Open the page and check the server rendered it, and its date, in the zone. */
const openInTimeZone = async (page: Page, timeZone: string, shown: Shown) => {
	const date = inZone(shown.at, shown.style, timeZone);
	expect(date, "date written in UTC").not.toBe(
		inZone(shown.at, shown.style, "UTC"),
	);
	const response = await page.goto(shown.path);
	const html = await response?.text();
	expect(html, "server render time zone").toContain(`"${timeZone}"`);
	expect(html, "server rendered date").toContain(date);
	await awaitHydration(page);
};

const createProvider = (admin: ApiClient) =>
	untilAllowed(() =>
		admin.provider.create({
			name: `Time zone ${runId()}`,
			description: "Time zone",
			endpoint: "http://127.0.0.1:9/v1",
			kind: "openai-compatible",
			meteringMode: "tokens",
			apiKey: "e2e-key",
			enabled: true,
		}),
	);

const createTitledChat = async (client: ApiClient) => {
	const title = `Time zone ${runId()}`;
	const { data: chat } = await client.chat.create({
		title,
	});
	return {
		title,
		updatedAt: dateOf(chat.updatedAt),
	};
};

// Each page in a test of its own, so a test's time stays flat. The shared
// fixtures fail the test on a hydration mismatch. Home writes a date only for a
// chat older than a week, which no public API creates.
const organisationPages: {
	readonly name: string;
	readonly show: (admin: ApiClient, org: WorkerOrganisation) => Promise<Shown>;
}[] = [
	{
		name: "the Chat page",
		show: async (admin) => {
			const chat = await createTitledChat(admin);
			return {
				path: `/app/chat?query=${encodeURIComponent(chat.title)}`,
				at: chat.updatedAt,
				style: "datetime",
			};
		},
	},
	{
		name: "the Providers page",
		show: async (admin) => {
			const { data: provider } = await createProvider(admin);
			return {
				path: "/app/providers",
				at: dateOf(provider.createdAt),
				style: "datetime",
			};
		},
	},
	{
		name: "the Providers page with invalid paging",
		show: async (admin) => {
			const { data: provider } = await createProvider(admin);
			return {
				path: "/app/providers?pageIndex=-1&pageSize=abc",
				at: dateOf(provider.createdAt),
				style: "datetime",
			};
		},
	},
	{
		name: "the Models page",
		show: async (admin) => {
			const { data: provider } = await createProvider(admin);
			const name = `Time zone ${runId()}`;
			const { data: model } = await admin.model.create({
				providerId: provider.id,
				providerModelId: `time-zone-${runId()}`,
				name,
				description: "Time zone",
				isDeprecated: false,
				capabilities: [
					"text",
				],
			});
			return {
				path: `/app/models?query=${encodeURIComponent(name)}`,
				at: dateOf(model.createdAt),
				style: "datetime",
			};
		},
	},
	{
		name: "a member's edit page",
		show: async (admin, org) => {
			const { data: member } = await admin.organizationMember.find({
				userId: org.users.member.id,
			});
			return {
				path: `/app/members/${org.users.member.id}/edit`,
				at: dateOf(member.createdAt),
				style: "date",
			};
		},
	},
];

for (const { name, show } of organisationPages) {
	test(`hydration: ${name} matches the server in another time zone`, async ({
		api,
		appBaseURL,
		newContext,
		org,
		seedZedToken,
	}) => {
		const shown = await show(api.as("admin"), org);
		const { page, timeZone } = await pageInZone(
			{
				appBaseURL,
				newContext,
				seedZedToken,
			},
			org.storageStates.admin,
			shown.at,
		);

		await enterApp(page, org.slug);
		await openInTimeZone(page, timeZone, shown);
	});
}

test("hydration: a chat with branches of one title matches the server in another time zone", async ({
	api,
	appBaseURL,
	inference,
	newContext,
	org,
	seedZedToken,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Time zone"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Hello?",
			reply: "Hello.",
		},
	});
	const messages = await member.chatMessage.list({
		chatId,
		limit: 10,
	});
	const reply = messages.data.at(-1);
	if (!reply) throw new Error("Missing stored reply");
	// Branches of one title carry their creation time.
	const branch = () =>
		member.chat.branch({
			chatId,
			messageId: reply.id,
		});
	await branch();
	const { data: latest } = await branch();
	const shown: Shown = {
		path: `/app/chat/${chatId}`,
		at: dateOf(latest.createdAt),
		style: "datetime",
	};
	const { page, timeZone } = await pageInZone(
		{
			appBaseURL,
			newContext,
			seedZedToken,
		},
		org.storageStates.member,
		shown.at,
	);

	await enterApp(page, org.slug);
	await openInTimeZone(page, timeZone, shown);
});

test("hydration: the History page matches the server in another time zone", async ({
	api,
	appBaseURL,
	newContext,
	org,
	seedZedToken,
	zedTokens,
}) => {
	// The history lists the chats of organisations the user has left.
	const user = await createUser("time-zone-history");
	await addMember(api.as("admin"), {
		user,
		role: "member",
		zedTokens,
	});
	const session = await signIn(appBaseURL, user);
	const client = createApiClient(appBaseURL, session.cookieHeader, zedTokens);
	await untilAllowed(() =>
		client.user.setActiveOrganization({
			organizationId: org.id,
		}),
	);
	const chat = await createTitledChat(client);
	await api.as("admin").organizationMember.delete({
		refs: [
			{
				userId: user.id,
			},
		],
	});
	const shown: Shown = {
		path: "/history",
		at: chat.updatedAt,
		style: "date",
	};
	const { page, timeZone } = await pageInZone(
		{
			appBaseURL,
			newContext,
			seedZedToken,
		},
		session.storageState,
		shown.at,
	);

	await openInTimeZone(page, timeZone, shown);
});

test("hydration: invitations show their expiry in the browser's time zone and match the server", async ({
	api,
	appBaseURL,
	newContext,
	org,
	seedZedToken,
}) => {
	const invitee = `time-zone-${runId()}@e2e.orcai.test`;
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await api.as("admin").organizationInvitation.create({
		role: "member",
		expiresAt,
		items: [
			{
				email: invitee,
			},
		],
	});
	const shown: Shown = {
		path: "/app/members/invitations",
		at: expiresAt,
		style: "datetime",
	};
	const { page, timeZone } = await pageInZone(
		{
			appBaseURL,
			newContext,
			seedZedToken,
		},
		org.storageStates.admin,
		shown.at,
	);

	await enterApp(page, org.slug);
	await openInTimeZone(page, timeZone, shown);
	await expect(
		page.getByRole("row").filter({
			hasText: invitee,
		}),
	).toContainText(inZone(expiresAt, "datetime", timeZone));
});

// The overview only redirects to the health page.
const instancePages: {
	readonly name: string;
	readonly show: (admin: ApiClient, org: WorkerOrganisation) => Promise<Shown>;
}[] = [
	{
		name: "health page",
		show: async (admin) => {
			const { data: health } = await admin.health.instance({});
			return {
				path: "/instance/health",
				at: dateOf(health.versions.migration?.appliedAt),
				style: "datetime",
			};
		},
	},
	{
		name: "users page",
		show: async (admin, org) => {
			const { data: user } = await admin.instance.user({
				id: org.users.admin.id,
			});
			return {
				path: `/instance/users?query=${encodeURIComponent(user.email)}`,
				at: dateOf(user.createdAt),
				style: "datetime",
			};
		},
	},
	{
		name: "organisations page",
		show: async (admin, org) => {
			const { data: organization } = await admin.instance.organization({
				id: org.id,
			});
			return {
				path: `/instance/organizations?query=${encodeURIComponent(org.slug)}`,
				at: dateOf(organization.createdAt),
				style: "datetime",
			};
		},
	},
	{
		name: "page of a user",
		show: async (admin, org) => {
			const memberships = await admin.instance.userMemberships({
				userId: org.users.admin.id,
				pageIndex: 0,
				pageSize: 10,
				query: org.name,
			});
			const membership = memberships.data.find(
				(row) => row.organizationId === org.id,
			);
			return {
				path: `/instance/users/${org.users.admin.id}?query=${encodeURIComponent(org.name)}`,
				at: dateOf(membership?.joinedAt),
				style: "date",
			};
		},
	},
	{
		name: "page of an organisation",
		show: async (admin, org) => {
			const email = org.users.admin.email;
			const members = await admin.instance.organizationMembers({
				organizationId: org.id,
				pageIndex: 0,
				pageSize: 10,
				query: email,
			});
			const member = members.data.find((row) => row.email === email);
			return {
				path: `/instance/organizations/${org.id}?query=${encodeURIComponent(email)}`,
				at: dateOf(member?.joinedAt),
				style: "date",
			};
		},
	},
];

for (const { name, show } of instancePages) {
	test(`hydration: the instance ${name} matches the server in another time zone`, async ({
		api,
		appBaseURL,
		newContext,
		org,
		seedZedToken,
	}) => {
		const shown = await show(api.asWellKnownAdmin(), org);
		const admin = await signIn(appBaseURL, WELL_KNOWN_ADMIN);
		const { page, timeZone } = await pageInZone(
			{
				appBaseURL,
				newContext,
				seedZedToken,
			},
			admin.storageState,
			shown.at,
		);

		await openInTimeZone(page, timeZone, shown);
	});
}

test("hydration: an entry added from the catalogue matches the server in the catalogue and the Library", async ({
	api,
	orgs,
	pageAs,
}) => {
	const id = runId();
	const author = api.as("member");
	const { data: behaviour } = await author.block.create({
		type: "behaviour",
		name: `E2E Hydration ${id}`,
		status: "ready",
		config: {
			systemPrompt: "A listed behaviour.",
		},
	});
	await author.resource.setVisibility({
		resourceType: "block",
		resourceId: behaviour.id,
		visibility: "public",
		listBlockIds: [],
	});

	const other = await orgs.create(`E2E Hydration ${id}`);
	await untilAllowed(() =>
		api.as("admin", other).catalogue.add({
			entry: {
				resourceType: "block",
				resourceId: behaviour.id,
			},
		}),
	);
	const page = await pageAs("admin", other);

	await enterApp(page, other.slug);
	await open(page, `/app/catalogue/behaviours?query=${id}`);
	await open(page, `/app/library?query=${id}`);
});

/*
 * A query only the browser fetches can be filled by a region that hydrated
 * earlier, so a later region would render differently from the server. The
 * tests below read the server's HTML for a page whose content depends on such
 * shared data, then open it once under the suite's page-error check.
 */

test("hydration: the server renders the organisation's missing assistant model", async ({
	api,
	org,
	pageAs,
	newContext,
}) => {
	await setAssistantModel(api.as("admin"), org, null);
	const chatId = await startConversation(api.as("member"));
	const page = await pageAs("member");
	await enterApp(page, org.slug);

	const html = await serverHtml(page, newContext, `/app/assistant/${chatId}`);
	await expect(
		html.getByText(message("assistant_unavailable_description_member")).first(),
	).toBeAttached();

	await open(page, `/app/assistant/${chatId}`);
});

test("hydration: the server renders the assistant's model by name", async ({
	api,
	inference,
	orgs,
	pageAs,
	newContext,
}) => {
	const fresh = await orgs.create(`E2E Hydration Model ${runId()}`);
	const admin = api.as("admin", fresh);
	const chat = await setUpChatModel(
		{
			...api,
			as: (role) => api.as(role, fresh),
		},
		inference,
	);
	const model = await createMockModel(admin, chat.providerId);
	await setAssistantModel(admin, fresh, model.modelId);
	const page = await pageAs("member", fresh);
	await enterApp(page, fresh.slug);

	const html = await serverHtml(page, newContext, "/app/assistant");
	await expect(
		html.getByText(model.name, {
			exact: true,
		}),
	).toBeAttached();

	await open(page, "/app/assistant");
});

test("hydration: the server renders the user's activity in the header and on Home", async ({
	api,
	orgs,
	pageAs,
	newContext,
}) => {
	const fresh = await orgs.create(`E2E Hydration Activity ${runId()}`);
	// Without workers both uploads fail at once and need the user.
	await uploadTogether(api.as("member", fresh), [
		`E2E Hydration ${runId()}.txt`,
		`E2E Hydration ${runId()}.txt`,
	]);
	const page = await pageAs("member", fresh);
	await enterApp(page, fresh.slug);

	const html = await serverHtml(page, newContext, "/app");
	await expect(
		html.getByRole("button", {
			name: "Activity, 2 need your attention",
			includeHidden: true,
		}),
	).toBeAttached();
	await expect(
		html.getByRole("heading", {
			name: message("activity_title"),
			exact: true,
			level: 2,
			includeHidden: true,
		}),
	).toBeAttached();

	await open(page, "/app");
});

test("hydration: the server renders a new chat with its bot", async ({
	api,
	org,
	pageAs,
	newContext,
}) => {
	const bot = await createBot(api.as("member"), "Hydration bot");
	const page = await pageAs("member");
	await enterApp(page, org.slug);

	const path = `/app/chat/new?botId=${bot.id}`;
	const html = await serverHtml(page, newContext, path);
	await expect(
		html
			.getByText(bot.name, {
				exact: true,
			})
			.first(),
	).toBeAttached();

	await open(page, path);
});

test("hydration: the server renders an empty Library kind with its New action", async ({
	orgs,
	pageAs,
	newContext,
}) => {
	const empty = await orgs.create(`E2E Empty Library ${runId()}`);
	const page = await pageAs("admin", empty);
	await enterApp(page, empty.slug);

	const html = await serverHtml(page, newContext, "/app/library/bots");
	await expect(
		html
			.getByRole("button", {
				name: message("library_new_action"),
				includeHidden: true,
			})
			.first(),
	).toBeAttached();

	await open(page, "/app/library/bots");
});

test("hydration: the server renders a bot's page with its blocks", async ({
	api,
	org,
	pageAs,
	newContext,
}) => {
	const member = api.as("member");
	const behaviourName = authzName("Hydration Behaviour");
	const behaviour = await member.block.create(behaviourInput(behaviourName));
	const bot = await member.bot.save(
		botSave({
			name: authzName("Hydration Bot"),
			behaviourId: behaviour.data.id,
		}),
	);
	const page = await pageAs("member");
	await enterApp(page, org.slug);

	const path = `/app/library/bots/${bot.data.id}`;
	const html = await serverHtml(page, newContext, path);
	await expect(
		html
			.getByText(behaviourName, {
				exact: true,
			})
			.first(),
	).toBeAttached();

	await open(page, path);
});

test("hydration: the server renders a model's page with its provider", async ({
	api,
	inference,
	orgs,
	pageAs,
	newContext,
}) => {
	const fresh = await orgs.create(`E2E Hydration Model Page ${runId()}`);
	const chat = await setUpChatModel(
		{
			...api,
			as: (role) => api.as(role, fresh),
		},
		inference,
	);
	const admin = api.as("admin", fresh);
	const model = await createMockModel(admin, chat.providerId);
	const provider = await admin.provider.find({
		id: chat.providerId,
	});
	const page = await pageAs("admin", fresh);
	await enterApp(page, fresh.slug);

	const path = `/app/models/${model.modelId}`;
	const html = await serverHtml(page, newContext, path);
	await expect(
		html
			.getByText(provider.data.name, {
				exact: true,
			})
			.first(),
	).toBeAttached();

	await open(page, path);
});
