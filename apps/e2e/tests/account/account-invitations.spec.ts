import {
	accountCard,
	openAccountPage,
} from "../../fixtures/account/navigation";
import { createAccountUser } from "../../fixtures/account/users";
import { pageForSession } from "../../fixtures/auth/users";
import { untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";

/** How long the app's own invitation form gives an invitation. */
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

test("account: the invitations card shows a pending invitation and accepting it adds the membership", async ({
	api,
	appBaseURL,
	browser,
	org,
	orgs,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "invite",
		admin: api.as("admin"),
		organisation: org,
	});

	// The invitation has to come from an organisation the user is not in yet.
	const second = await orgs.create("Account Invitations");

	await untilAllowed(() =>
		api.as("admin", second).organizationInvitation.create({
			organizationId: second.id,
			role: "member",
			expiresAt: new Date(Date.now() + ONE_WEEK),
			items: [
				{
					email: user.email,
				},
			],
		}),
	);

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);

		const invitations = accountCard(page, "Organisation Invitations");

		// The list carries the organisation's name and slug, so the invitee
		// can tell the entries apart without reading the organisation.
		const entry = invitations
			.getByText(`@${second.slug}`, {
				exact: true,
			})
			.locator('xpath=ancestor::div[@data-slot="card"][1]');

		await expect(entry).toBeVisible();
		await expect(entry.getByText("Pending")).toBeVisible();

		await expect(async () => {
			await entry
				.getByRole("button", {
					name: "Accept",
				})
				.click();
			await expect(page.getByText("Invitation accepted")).toBeVisible({
				timeout: 5_000,
			});
		}).toPass({
			timeout: 25_000,
		});

		// Accepting writes the membership, which the user's own organisation
		// list reports from the database.
		await expect
			.poll(async () =>
				(
					await user.api.organization.list({
						pageIndex: 0,
						pageSize: 100,
					})
				).data.map((organisation) => organisation.slug),
			)
			.toContain(second.slug);
	} finally {
		await context.close();
	}
});

test("account: the invitations card names the inviting organisation", async ({
	api,
	appBaseURL,
	browser,
	org,
	orgs,
}) => {
	const user = await createAccountUser({
		baseURL: appBaseURL,
		label: "invite-name",
		admin: api.as("admin"),
		organisation: org,
	});
	const second = await orgs.create("Account Invitation Name");

	await untilAllowed(() =>
		api.as("admin", second).organizationInvitation.create({
			organizationId: second.id,
			role: "member",
			expiresAt: new Date(Date.now() + ONE_WEEK),
			items: [
				{
					email: user.email,
				},
			],
		}),
	);

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await openAccountPage(page);

		const invitations = accountCard(page, "Organisation Invitations");

		await expect(
			invitations.getByText(second.name, {
				exact: true,
			}),
		).toBeVisible();
		await expect(
			invitations.getByText(`@${second.slug}`, {
				exact: true,
			}),
		).toBeVisible();
	} finally {
		await context.close();
	}
});
