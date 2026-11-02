import type { Page } from "@playwright/test";
import {
	setAssistantModel,
	startConversation,
} from "../../fixtures/assistant/assistant";
import { untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

// Far from the server's UTC, so a date written in the wrong zone reads differently.
const TIME_ZONE = "Pacific/Kiritimati";

test.use({
	timezoneId: TIME_ZONE,
});

/** Uncaught page errors, which is where React reports a hydration mismatch. */
const recordPageErrors = (page: Page) => {
	const errors: string[] = [];

	page.on("pageerror", (error) => {
		errors.push(`${page.url()}: ${error.message}`);
	});

	return errors;
};

/**
 * Slow the page's CPU, not its network, so a query the sidebar fetches after
 * the shell hydrates lands before React hydrates the page content.
 */
const slowCpu = async (page: Page) => {
	const session = await page.context().newCDPSession(page);
	await session.send("Emulation.setCPUThrottlingRate", {
		rate: 6,
	});
};

const openEach = async (page: Page, errors: string[], paths: string[]) => {
	for (const path of paths) {
		await open(page, path);
		expect(errors, path).toEqual([]);
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
	const errors = recordPageErrors(page);

	// The first load has no time zone cookie yet, later ones do.
	await enterApp(page, org.slug);
	await openEach(page, errors, [
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
	const errors = recordPageErrors(page);

	await openEach(page, errors, [
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
	const errors = recordPageErrors(page);

	await enterApp(page, other.slug);
	await slowCpu(page);
	await openEach(
		page,
		errors,
		[
			`/app/catalogue/behaviours?query=${id}`,
			`/app/library?query=${id}`,
		].flatMap((path) => [
			path,
			path,
		]),
	);
});

// The sidebar fetches the organisation and its capabilities once the shell
// hydrates, often before the page does. A page reading them must not see them
// first, which a few loads catch nearly every time.
test("hydration: a page reading the organisation matches the server", async ({
	api,
	org,
	pageAs,
}) => {
	await setAssistantModel(api.as("admin"), org, null);
	const chatId = await startConversation(api.as("member"));

	const page = await pageAs("member");
	const errors = recordPageErrors(page);

	await enterApp(page, org.slug);
	await slowCpu(page);
	await openEach(
		page,
		errors,
		Array.from(
			{
				length: 4,
			},
			() => `/app/assistant/${chatId}`,
		),
	);
});
