import type { Page } from "@playwright/test";
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
