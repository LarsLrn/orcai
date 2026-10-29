import { EMAIL_DOMAIN } from "../../fixtures/constants";
import { submitForm } from "../../fixtures/forms";
import { expect, test } from "../../fixtures/index";
import { memberRow, reachPage } from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

/**
 * "Add user" on the members page is an invitation form: it never creates an
 * account, it queues an invitation per email address for the selected
 * organisation and role and then shows the invitations list.
 */
test("members: an admin invites a user from the members page", async ({
	org,
	pageAs,
}) => {
	const email = `e2e-members-invited-${runId()}@${EMAIL_DOMAIN}`;
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/app/members/add", message("members_add_page_title"));

	await submitForm(page, {
		fill: async () => {
			await page
				.getByLabel(
					message("orgs_invitation_form_email_label", {
						position: 1,
					}),
				)
				.fill(email);
		},
		submit: message("orgs_invitation_form_submit_button"),
		until: /\/app\/members\/invitations/,
	});

	await expect(
		page.getByRole("heading", {
			name: message("members_invitations_page_title"),
		}),
	).toBeVisible();

	const row = memberRow(page, email);
	await expect(row).toBeVisible();
	await expect(row).toContainText("pending");
	await expect(row).toContainText("member");
});

test("members: the add form refuses an invalid email", async ({
	org,
	pageAs,
}) => {
	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/app/members/add", message("members_add_page_title"));

	await page
		.getByLabel(
			message("orgs_invitation_form_email_label", {
				position: 1,
			}),
		)
		.fill("not-an-email");
	await page
		.getByRole("button", {
			name: message("orgs_invitation_form_submit_button"),
		})
		.click();
	await expect(
		page.getByText(message("forms_validation_errors_title")),
	).toBeVisible();

	await expect(
		page.getByText(
			`${message("orgs_invitation_form_email_label", {
				position: 1,
			})}: ${message("error_validation_invalid_email")}`,
		),
	).toBeVisible();
	await expect(page).toHaveURL(/\/app\/members\/add/);
});

/**
 * A context change above the route while its lazy fields still load, or text
 * the browser renders differently from the server, makes React drop the
 * server-rendered form and render a second copy. The default expiry date is
 * such text when the minute changes between rendering and hydration. Any
 * mismatch, in the form or the app shell, surfaces as a page error.
 */
for (const { condition, theme, colorScheme, clockAheadMs } of [
	{
		condition: "the dark theme",
		theme: "dark",
		colorScheme: "light",
		clockAheadMs: 0,
	},
	{
		condition: "the system theme",
		theme: "system",
		colorScheme: "dark",
		clockAheadMs: 0,
	},
	{
		condition: "a browser clock ahead of the server",
		theme: "system",
		colorScheme: "dark",
		clockAheadMs: 60 * 60 * 1000,
	},
] as const) {
	test(`members: the add form keeps its server-rendered form through hydration with ${condition}`, async ({
		org,
		pageAs,
	}) => {
		const page = await pageAs("admin");
		await enterApp(page, org.slug);
		await page.emulateMedia({
			colorScheme,
		});
		if (clockAheadMs > 0) {
			await page.clock.setFixedTime(Date.now() + clockAheadMs);
		}
		await page.context().addCookies([
			{
				name: "theme",
				value: theme,
				url: new URL(page.url()).origin,
			},
		]);

		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));

		// Scripts are held back until the server-rendered form is in hand.
		let releaseScripts!: () => void;
		const scriptsReleased = new Promise<void>((resolve) => {
			releaseScripts = resolve;
		});
		await page.route("**/*", async (route) => {
			if (route.request().resourceType() === "script") await scriptsReleased;
			await route.fallback();
		});

		await page.goto("/app/members/add", {
			waitUntil: "commit",
		});
		const serverForm = await page.locator("form").elementHandle();
		releaseScripts();
		await awaitHydration(page);
		await expect(page.locator("html")).toHaveClass(/\bdark\b/);
		await expect(
			page.getByLabel(
				message("orgs_invitation_form_email_label", {
					position: 1,
				}),
			),
		).toBeVisible();

		expect(await serverForm?.isVisible()).toBe(true);
		await expect(page.locator("form")).toHaveCount(1);
		// The user menu names the organisation once its part of the shell hydrated.
		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toBeVisible();
		expect(pageErrors).toEqual([]);
	});
}
