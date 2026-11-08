import type { Page } from "@playwright/test";
import { uploadTogether } from "../../fixtures/activity/uploads";
import { createBot } from "../../fixtures/assistant/approval";
import {
	createMockModel,
	setAssistantModel,
	startConversation,
} from "../../fixtures/assistant/assistant";
import { untilAllowed } from "../../fixtures/authorization";
import { setUpChatModel } from "../../fixtures/chat/chat";
import { serverHtml } from "../../fixtures/hydration/server-html";
import { expect, test } from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

// Far from the server's UTC, so a date written in the wrong zone reads differently.
const TIME_ZONE = "Pacific/Kiritimati";

test.use({
	timezoneId: TIME_ZONE,
});

// The shared fixtures fail the test on a hydration mismatch.
const openEach = async (page: Page, paths: string[]) => {
	for (const path of paths) {
		await open(page, path);
	}
};

test("hydration: organisation pages with dates match the server in another time zone", async ({
	api,
	org,
	pageAs,
}) => {
	const admin = api.as("admin");
	await untilAllowed(() =>
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
	const invitee = `time-zone-${runId()}@e2e.orcai.test`;
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await admin.organizationInvitation.create({
		role: "member",
		expiresAt,
		items: [
			{
				email: invitee,
			},
		],
	});
	const { data: chat } = await admin.chat.create({
		title: `Time zone ${runId()}`,
	});

	const page = await pageAs("admin");

	// The first load has no time zone cookie yet, later ones do.
	await enterApp(page, org.slug);
	await openEach(page, [
		"/app",
		"/app/chat",
		`/app/chat/${chat.id}`,
		"/history",
		"/app/members/invitations",
		"/app/providers",
		"/app/providers?pageIndex=-1&pageSize=abc",
		"/app/models",
		`/app/members/${org.users.member.id}/edit`,
	]);

	await open(page, "/app/members/invitations");
	await expect(
		page.getByRole("row").filter({
			hasText: invitee,
		}),
	).toContainText(
		new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: TIME_ZONE,
		}).format(expiresAt),
	);
});

test("hydration: instance pages with dates match the server in another time zone", async ({
	org,
	pageAsWellKnownAdmin,
}) => {
	const page = await pageAsWellKnownAdmin();

	await openEach(page, [
		"/instance",
		"/instance/health",
		"/instance/users",
		"/instance/organizations",
		`/instance/users/${org.users.admin.id}`,
		`/instance/organizations/${org.id}`,
	]);
});

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
	await openEach(page, [
		`/app/catalogue/behaviours?query=${id}`,
		`/app/library?query=${id}`,
	]);
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
