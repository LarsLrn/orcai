import { randomUUID } from "node:crypto";
import { organizationInvitationIdSchema } from "@orcai/schema";
import { createApiClient } from "../../fixtures/api";
import { rejection } from "../../fixtures/authorization";
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

	await api.as("admin").organizationInvitation.delete({
		refs: [
			{
				id: invitation.id,
			},
		],
	});

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
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "accepts");
	const invitation = await inviteEmail(api.as("admin"), {
		email: user.email,
		role: "viewer",
	});

	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);

	const accepted = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(accepted.success).toBe(true);

	expect(
		await memberRole(api.as("admin"), {
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
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "removed-after-accept");
	const invitation = await inviteEmail(api.as("admin"), {
		email: user.email,
		role: "member",
	});

	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);
	const accepted = await asUser.organizationInvitation.respond({
		id: invitation.id,
		response: "accept",
	});
	expect(accepted.success).toBe(true);

	await api.as("admin").organizationMember.delete({
		refs: [
			{
				userId: user.id,
			},
		],
	});

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

	expect(
		(
			await rejection(
				api.as("admin").organizationMember.find({
					userId: user.id,
				}),
			)
		).code,
	).toBe("NOT_FOUND");
});

test("orgs: rejecting an invitation leaves the invitee outside the organisation", async ({
	api,
	appBaseURL,
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "rejects");
	const invitation = await inviteEmail(api.as("admin"), {
		email: user.email,
		role: "member",
	});

	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);

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

	expect(
		(
			await rejection(
				api.as("admin").organizationMember.find({
					userId: user.id,
				}),
			)
		).code,
	).toBe("NOT_FOUND");
});

test("orgs: only the invited address may respond to an invitation", async ({
	api,
	appBaseURL,
	zedTokens,
}) => {
	const invited = invitationEmail("stranger-target");
	const invitation = await inviteEmail(api.as("admin"), {
		email: invited,
		role: "member",
	});

	const stranger = await createOrgsUser(appBaseURL, "stranger");
	const asStranger = createApiClient(
		appBaseURL,
		stranger.session.cookieHeader,
		zedTokens,
	);

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
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "expired");
	const invitation = await inviteEmail(api.as("admin"), {
		email: user.email,
		role: "member",
	});

	await api.as("admin").organizationInvitation.update({
		id: invitation.id,
		expiresAt: new Date(Date.now() - 60_000),
	});

	const expired = await api.as("admin").organizationInvitation.validate({
		id: invitation.id,
	});
	expect(expired.data.isValid).toBe(false);
	expect(expired.data.reason).toBe("expired");

	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);

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
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "mixed-case");
	const [local, domain] = user.email.split("@");
	const mixedCase = `${local.toUpperCase()}@${domain}`;

	const invitation = await inviteEmail(api.as("admin"), {
		email: mixedCase,
		role: "member",
	});

	// Sign-up, `respond`, and the list all compare the trimmed, lowercased
	// address, so the invitee finds an invitation addressed in another case.
	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);
	const listed = await asUser.organizationInvitation.listMine({
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
	zedTokens,
}) => {
	const email = invitationEmail("find-scope");
	const invitation = await inviteEmail(api.as("admin"), {
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
	const asStranger = createApiClient(
		appBaseURL,
		stranger.session.cookieHeader,
		zedTokens,
	);
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

test("orgs: listMine carries the invitations addressed to the caller, not those it sent", async ({
	api,
	appBaseURL,
	org,
	zedTokens,
}) => {
	const sent = invitationEmail("sent-by-me");
	const sentInvitation = await inviteEmail(api.as("admin"), {
		email: sent,
		role: "member",
	});

	const user = await createOrgsUser(appBaseURL, "list-mine");
	const received = await inviteEmail(api.as("admin"), {
		email: user.email,
		role: "member",
	});

	const mine = await api.as("admin").organizationInvitation.listMine({
		pageIndex: 0,
		pageSize: 100,
	});
	expect(mine.data.map((row) => String(row.id))).not.toContain(
		String(sentInvitation.id),
	);

	// The invitee belongs to no organisation yet, so nothing is active; the
	// rows carry the name and slug it cannot read otherwise.
	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);
	const theirs = await asUser.organizationInvitation.listMine({
		pageIndex: 0,
		pageSize: 100,
	});
	const row = theirs.data.find((entry) => entry.id === received.id);
	expect(row?.organizationName).toBe(org.name);
	expect(row?.organizationSlug).toBe(org.slug);
	expect(theirs.data.map((entry) => String(entry.id))).not.toContain(
		String(sentInvitation.id),
	);
	expect(theirs.rowCount).toBe(theirs.data.length);
});

test("orgs: member and invitation procedures need an active organisation", async ({
	appBaseURL,
	zedTokens,
}) => {
	const user = await createOrgsUser(appBaseURL, "no-active");
	const asUser = createApiClient(
		appBaseURL,
		user.session.cookieHeader,
		zedTokens,
	);

	const page = {
		pageIndex: 0,
		pageSize: 10,
	};

	for (const call of [
		() => asUser.organizationMember.list(page),
		() => asUser.organizationInvitation.list(page),
	]) {
		const refused = await rejection(call());
		expect(refused.code).toBe("BAD_REQUEST");
		expect(refused.data).toMatchObject({
			reason: "ACTIVE_ORGANIZATION_REQUIRED",
		});
	}
});
