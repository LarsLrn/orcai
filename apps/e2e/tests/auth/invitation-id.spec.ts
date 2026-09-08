import { randomUUID } from "node:crypto";
import { organizationInvitationIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { attemptSignUp, signIn } from "../../fixtures/auth";
import { USER_PASSWORD } from "../../fixtures/constants";
import { expect, test, type WorkerOrganisation } from "../../fixtures/index";
import { open } from "../../fixtures/navigation";
import { registerFromInvitation } from "../../fixtures/orgs/invitations";

test("registration validates the selected invitation and leaves the others pending", async ({
	api,
	org,
	orgs,
	appBaseURL,
	browser,
}) => {
	const second = await orgs.create("Pending invitation");
	const email = `selected-${randomUUID()}@e2e.orcai.test`;
	// Each organisation invites through its own admin, whose membership the
	// organisation fixture has already read back.
	const invite = async (organisation: WorkerOrganisation) =>
		(
			await api.as("admin", organisation).organizationInvitation.create({
				organizationId: organisation.id,
				role: "viewer",
				expiresAt: new Date(Date.now() + 86400000),
				items: [
					{
						email,
					},
				],
			})
		).data[0].id;
	const firstId = await invite(org);
	const secondId = await invite(second);
	const signup = {
		name: "Selected invitation",
		email,
		password: USER_PASSWORD,
	};
	for (const invitationId of [
		undefined,
		organizationInvitationIdSchema.parse(randomUUID()),
	]) {
		expect(
			(
				await attemptSignUp(appBaseURL, {
					...signup,
					invitationId,
				})
			).ok,
		).toBe(false);
	}
	expect(
		(
			await attemptSignUp(appBaseURL, {
				...signup,
				email: `wrong-${email}`,
				invitationId: firstId,
			})
		).ok,
	).toBe(false);
	for (const patch of [
		{
			expiresAt: new Date(Date.now() - 60_000),
		},
		{
			status: "accepted" as const,
		},
	]) {
		await api.as("admin").organizationInvitation.update({
			organizationId: org.id,
			id: firstId,
			...patch,
		});
		expect(
			(
				await attemptSignUp(appBaseURL, {
					...signup,
					invitationId: firstId,
				})
			).ok,
		).toBe(false);
		await api.as("admin").organizationInvitation.update({
			organizationId: org.id,
			id: firstId,
			status: "pending",
			expiresAt: new Date(Date.now() + 86400000),
		});
	}
	const accepted = await attemptSignUp(appBaseURL, {
		...signup,
		email: email.toUpperCase(),
		invitationId: firstId,
	});
	expect(accepted.ok, await accepted.clone().text()).toBe(true);
	const session = await signIn(appBaseURL, {
		email,
		password: USER_PASSWORD,
	});
	const client = createApiClient(appBaseURL, session.cookieHeader);
	expect(
		(
			await client.organizationInvitation.validate({
				id: firstId,
			})
		).data.reason,
	).toBe("consumed");
	expect(
		(
			await client.organizationInvitation.validate({
				id: secondId,
			})
		).data.isValid,
	).toBe(true);
	const context = await browser.newContext({
		storageState: session.storageState,
	});
	try {
		const page = await context.newPage();
		await open(page, "/en/select-organization");
		await expect(
			page.getByText("Pending invitations", {
				exact: true,
			}),
		).toBeVisible();
		await expect(
			page.getByRole("heading", {
				name: "Select your organisation",
			}),
		).toBeVisible();
	} finally {
		await context.close();
	}
	await client.organizationInvitation.respond({
		id: secondId,
		response: "accept",
	});
	await expect(
		client.organizationInvitation.respond({
			id: secondId,
			response: "accept",
		}),
	).rejects.toThrow();
});

test("registration lands on the picker when another invitation is pending", async ({
	api,
	org,
	orgs,
	page,
}) => {
	const other = await orgs.create("Additional registration invitation");
	const email = `picker-${randomUUID()}@e2e.orcai.test`;
	// Each organisation invites through its own admin, whose membership the
	// organisation fixture has already read back.
	const invite = async (organisation: WorkerOrganisation) =>
		(
			await api.as("admin", organisation).organizationInvitation.create({
				organizationId: organisation.id,
				role: "viewer",
				expiresAt: new Date(Date.now() + 86400000),
				items: [
					{
						email,
					},
				],
			})
		).data[0].id;
	const firstId = await invite(org);
	await invite(other);
	await registerFromInvitation(page, `/en/register?inv=${firstId}`, {
		name: "Picker registration",
		password: USER_PASSWORD,
		organisationName: org.name,
		until: /\/en\/select-organization/,
	});
	await expect(
		page.getByText("Pending invitations", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button").filter({
			hasText: `@${org.slug}`,
		}),
	).toBeVisible();
});
