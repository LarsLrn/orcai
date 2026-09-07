import { randomUUID } from "node:crypto";
import { organizationInvitationIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { rejection, untilAllowed } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";
import { invitationEmail, inviteEmail } from "../../fixtures/orgs/invitations";
import { createOrgsUser, memberRole } from "../../fixtures/orgs/members";

test("orgs: validating an invitation reports why it cannot be used", async ({
	api,
	org,
}) => {
	const unknown = await api.as("admin").organizationInvitation.validate({
		id: organizationInvitationIdSchema.parse(randomUUID()),
	});
	expect(unknown.data.isValid).toBe(false);
	expect(unknown.data.reason).toBe("not_found");
	expect(unknown.data.email).toBeNull();
	expect(unknown.data.organizationName).toBeNull();
	expect(unknown.data.organizationSlug).toBeNull();

	const email = invitationEmail("validate");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email,
		role: "member",
	});

	const pending = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(pending.data.isValid).toBe(true);
	expect(pending.data.reason).toBeNull();
	expect(pending.data.email).toBe(email);
	// The register page names the inviting organisation, which the invitee
	// may not read, so `validate` carries it.
	expect(pending.data.organizationName).toBe(org.name);
	expect(pending.data.organizationSlug).toBe(org.slug);

	await untilAllowed(() =>
		api.as("admin").organizationInvitation.delete({
			organizationId: org.id,
			refs: [
				{
					id: invitation.id,
				},
			],
		}),
	);

	const revoked = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(revoked.data.isValid).toBe(false);
	expect(revoked.data.reason).toBe("not_found");
	expect(revoked.data.organizationName).toBeNull();
	expect(revoked.data.organizationSlug).toBeNull();
});

test("orgs: accepting an invitation makes the invitee a member with the invited role", async ({
	api,
	appBaseURL,
	org,
}) => {
	const user = await createOrgsUser(appBaseURL, "accepts");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "viewer",
	});

	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);

	const accepted = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(accepted.success).toBe(true);

	expect(
		await memberRole(api.as("admin"), {
			organizationId: org.id,
			userId: user.id,
		}),
	).toBe("viewer");

	// The invitation is consumed, so the registration route turns it away.
	const validated = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(validated.data.isValid).toBe(false);
	expect(validated.data.reason).toBe("consumed");

	// The invitation is spent, so neither answer is taken a second time.
	expect(
		(
			await rejection(
				asUser.organizationInvitation.respond({
					id: invitation.id,
					response: "accept",
				}),
			)
		).code,
	).toBe("BAD_REQUEST");

	expect(
		(
			await rejection(
				asUser.organizationInvitation.respond({
					id: invitation.id,
					response: "reject",
				}),
			)
		).code,
	).toBe("BAD_REQUEST");
});

test("orgs: a spent invitation does not return a removed member", async ({
	api,
	appBaseURL,
	org,
}) => {
	const user = await createOrgsUser(appBaseURL, "removed-after-accept");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "member",
	});

	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);
	const accepted = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(accepted.success).toBe(true);

	await untilAllowed(() =>
		api.as("admin").organizationMember.delete({
			organizationId: org.id,
			refs: [
				{
					userId: user.id,
				},
			],
		}),
	);

	/** The invitation is accepted, not pending, so the address cannot rejoin
	 * through it. Somebody must invite the address again. */
	expect(
		(
			await rejection(
				asUser.organizationInvitation.respond({
					id: invitation.id,
					response: "accept",
				}),
			)
		).code,
	).toBe("BAD_REQUEST");

	const members = await api.as("admin").organizationMember.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(members.data.map((member) => member.userId)).not.toContain(user.id);
});

test("orgs: rejecting an invitation leaves the invitee outside the organisation", async ({
	api,
	appBaseURL,
	org,
}) => {
	const user = await createOrgsUser(appBaseURL, "rejects");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "member",
	});

	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);

	const rejected = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "reject",
	});
	expect(rejected.success).toBe(true);

	const validated = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(validated.data.isValid).toBe(false);
	expect(validated.data.reason).toBe("consumed");

	expect(
		(
			await rejection(
				asUser.organizationInvitation.respond({
					id: invitation.id,
					response: "accept",
				}),
			)
		).code,
	).toBe("BAD_REQUEST");

	const members = await api.as("admin").organizationMember.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(members.data.map((member) => member.userId)).not.toContain(user.id);
});

test("orgs: only the invited address may respond to an invitation", async ({
	api,
	appBaseURL,
	org,
}) => {
	const invited = invitationEmail("stranger-target");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: invited,
		role: "member",
	});

	const stranger = await createOrgsUser(appBaseURL, "stranger");
	const asStranger = createApiClient(appBaseURL, stranger.session.cookieHeader);

	expect(
		(
			await rejection(
				asStranger.organizationInvitation.respond({
					id: invitation.id,
					response: "accept",
				}),
			)
		).code,
	).toBe("FORBIDDEN");

	const stillPending = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(stillPending.data.isValid).toBe(true);
});

test("orgs: an expired invitation cannot be accepted", async ({
	api,
	appBaseURL,
	org,
}) => {
	const user = await createOrgsUser(appBaseURL, "expired");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "member",
	});

	await untilAllowed(() =>
		api.as("admin").organizationInvitation.update({
			organizationId: org.id,
			id: invitation.id,
			expiresAt: new Date(Date.now() - 60_000),
		}),
	);

	const expired = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(expired.data.isValid).toBe(false);
	expect(expired.data.reason).toBe("expired");

	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);

	expect(
		(
			await rejection(
				asUser.organizationInvitation.respond({
					id: invitation.id,
					response: "accept",
				}),
			)
		).code,
	).toBe("BAD_REQUEST");
});

test("orgs: an invitation reaches the invitee whatever case it was sent to", async ({
	api,
	appBaseURL,
	org,
}) => {
	const user = await createOrgsUser(appBaseURL, "mixed-case");
	const [local, domain] = user.email.split("@");
	const mixedCase = `${local.toUpperCase()}@${domain}`;

	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: mixedCase,
		role: "member",
	});

	// Sign-up, `respond`, and the list all compare the trimmed, lowercased
	// address, so the invitee finds an invitation addressed in another case.
	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);
	const listed = await asUser.organizationInvitation.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			status: "pending",
		},
	});
	expect(listed.data.map((row) => String(row.id))).toContain(
		String(invitation.id),
	);

	const accepted = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(accepted.success).toBe(true);
});

test("orgs: finding an invitation is scoped to the caller", async ({
	api,
	appBaseURL,
	org,
}) => {
	const email = invitationEmail("find-scope");
	const invitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email,
		role: "member",
	});

	// The admin sent it, so it is theirs to read.
	const found = await api.as("admin").organizationInvitation.find({
		id: invitation.id,
	});
	expect(String(found.data.id)).toBe(String(invitation.id));

	// There is no permission over an invitation, so a signed-in user who
	// neither sent nor received one is answered as if it were not there.
	const stranger = await createOrgsUser(appBaseURL, "find-stranger");
	const asStranger = createApiClient(appBaseURL, stranger.session.cookieHeader);
	expect(
		(
			await rejection(
				asStranger.organizationInvitation.find({
					id: invitation.id,
				}),
			)
		).code,
	).toBe("NOT_FOUND");

	for (const role of [
		"manager",
		"member",
		"viewer",
	] as const) {
		expect(
			(
				await rejection(
					api.as(role).organizationInvitation.find({
						id: invitation.id,
					}),
				)
			).code,
		).toBe("NOT_FOUND");
	}
});

test("orgs: the recipient filter leaves out what the caller sent", async ({
	api,
	appBaseURL,
	org,
}) => {
	const sent = invitationEmail("sent-by-me");
	const sentInvitation = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: sent,
		role: "member",
	});

	const user = await createOrgsUser(appBaseURL, "recipient-filter");
	const received = await inviteEmail(api.as("admin"), {
		organizationId: org.id,
		email: user.email,
		role: "member",
	});

	// Unfiltered, the admin's list carries everything it sent.
	const all = await api.as("admin").organizationInvitation.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(all.data.map((row) => String(row.id))).toContain(
		String(sentInvitation.id),
	);

	// The account card and the selection page only ever show what the caller
	// was sent, so the server narrows it rather than a loaded page.
	const mine = await api.as("admin").organizationInvitation.list({
		organizationId: org.id,
		pageIndex: 0,
		pageSize: 100,
		filters: {
			recipient: "me",
		},
	});
	expect(mine.data.map((row) => String(row.id))).not.toContain(
		String(sentInvitation.id),
	);
	expect(mine.rowCount).toBe(mine.data.length);

	const asUser = createApiClient(appBaseURL, user.session.cookieHeader);
	const theirs = await asUser.organizationInvitation.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			recipient: "me",
		},
	});
	expect(theirs.data.map((row) => String(row.id))).toContain(
		String(received.id),
	);
});
