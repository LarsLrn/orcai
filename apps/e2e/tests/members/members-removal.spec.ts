import { createApiClient } from "../../fixtures/api";
import { pageForSession } from "../../fixtures/auth/users";
import { expectDenied, expectForbidden } from "../../fixtures/authorization";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import {
	addMember,
	adoptZedToken,
	createThrowawayUser,
	memberRow,
	reachPage,
} from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test("members: an admin removes a user from the organisation", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "removed");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/app/members", message("members_page_title"));

	const row = memberRow(page, user.email);
	await expect(row).toBeVisible();

	// The row menu of the organisation members list acts on the membership;
	// deleting the account is an instance action on Instance > Users.
	await row
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("members_remove_from_organisation_action"),
		})
		.click();
	await page
		.getByRole("button", {
			name: message("common_remove_button"),
			exact: true,
		})
		.click();

	// The confirmation is modal, so the row behind it is hidden from the
	// accessibility tree until the dialog goes.
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toHaveCount(0);

	// The removal happened in the browser, so the API client takes its revision
	// from the page. The account survives it; only the membership is gone, so
	// the user drops out of the organisation's list and out of `organizationMember.find`.
	await adoptZedToken(page, zedTokens);
	await expectDenied(
		api.as("admin").organizationMember.find({
			userId: user.id,
		}),
	);
});

test("members: a removed user loses the organisation it was signed in to", async ({
	api,
	browser,
	org,
	seedZedToken,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "evicted");
	await addMember(api, org, user, "member", zedTokens);
	await createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	).user.setActiveOrganization({
		organizationId: org.id,
	});

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await seedZedToken(page);
		await enterApp(page, org.slug);

		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toBeVisible();

		await api.as("admin").organizationMember.delete({
			refs: [
				{
					userId: user.id,
				},
			],
		});

		await seedZedToken(page);
		await open(page, "/app");

		await expect(page).toHaveURL(/\/select-organization/);
	} finally {
		await context.close();
	}
});

test("members: an admin deletes a user's account", async ({
	api,
	org,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "deleted");
	await addMember(api, org, user, "member", zedTokens);

	// Deleting an account is an instance action, so an organisation admin is
	// refused however much it may manage inside its own organisation.
	await expectForbidden(
		api.as("admin").user.delete({
			userIds: [
				user.id,
			],
		}),
	);

	const deleted = await api.asWellKnownAdmin().user.delete({
		userIds: [
			user.id,
		],
	});
	expect(deleted.success).toBe(true);
	expect(deleted.deletedCount).toBe(1);

	await expectDenied(
		api.as("admin").organizationMember.find({
			userId: user.id,
		}),
	);
});

test("members: deleting an account hands its content to the chosen member", async ({
	api,
	org,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "owner");
	await addMember(api, org, user, "member", zedTokens);

	// A throwaway user is created without an organisation, and creating a
	// block is an organisation action, so the session gets one first.
	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});
	const { data: block } = await client.block.create({
		type: "behaviour",
		name: `E2E Users Owned ${user.id}`,
		status: "ready",
		config: {
			systemPrompt: "Created by the members slice.",
		},
	});

	const deleted = await api.asWellKnownAdmin().user.delete({
		userIds: [
			user.id,
		],
		receivers: [
			{
				organizationId: org.id,
				userId: org.users.admin.id,
			},
		],
	});
	expect(deleted.deletedCount).toBe(1);

	const found = await api.as("admin").block.find({
		id: block.id,
	});
	expect(found.data.userId).toBe(org.users.admin.id);
});

test("members: a removed user loses the access its groups and grants gave it", async ({
	api,
	org,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "detached");
	await addMember(api, org, user, "member", zedTokens);
	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);

	// A group both the granting admin and the target belong to: sharing with a
	// group is only offered for the groups the caller is in.
	const group = await api.as("admin").group.create({
		name: `E2E Users Detach ${user.id}`,
	});
	await api.as("admin").group.addMembers({
		groupId: group.data.id,
		userIds: [
			org.users.admin.id,
			user.id,
		],
	});

	const block = (name: string) => ({
		type: "behaviour" as const,
		name,
		status: "ready" as const,
		config: {
			systemPrompt: "Created by the members slice.",
		},
	});

	const throughGroup = await api
		.as("admin")
		.block.create(block(`E2E Users Group Block ${user.id}`));
	const throughGrant = await api
		.as("admin")
		.block.create(block(`E2E Users Grant Block ${user.id}`));

	await api.as("admin").resource.grant({
		resourceType: "block",
		resourceId: throughGroup.data.id,
		principals: [
			{
				principalType: "group",
				principalId: group.data.id,
			},
		],
		role: "viewer",
	});
	await api.as("admin").resource.grant({
		resourceType: "block",
		resourceId: throughGrant.data.id,
		principals: [
			{
				principalType: "user",
				principalId: user.id,
			},
		],
		role: "viewer",
	});

	// Both blocks are private, so reaching them is the group membership and
	// the direct grant, nothing else.
	await client.block.find({
		id: throughGroup.data.id,
	});
	await client.block.find({
		id: throughGrant.data.id,
	});

	await api.as("admin").organizationMember.delete({
		refs: [
			{
				userId: user.id,
			},
		],
	});

	await expectDenied(
		client.block.find({
			id: throughGroup.data.id,
		}),
	);
	await expectDenied(
		client.block.find({
			id: throughGrant.data.id,
		}),
	);

	const grants = await api.as("admin").resource.listGrants({
		resourceType: "block",
		resourceId: throughGrant.data.id,
	});
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(user.id),
	);
});
