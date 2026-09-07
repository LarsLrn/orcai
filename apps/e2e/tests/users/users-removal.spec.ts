import { createApiClient } from "../../fixtures/api";
import { pageForSession } from "../../fixtures/auth/users";
import {
	expectDenied,
	expectForbidden,
	rejection,
	untilAllowed,
} from "../../fixtures/authorization";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import {
	addMember,
	createThrowawayUser,
	reachPage,
	userRow,
} from "../../fixtures/users/users";

test("users: an admin removes a user from the organisation", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "removed");
	await addMember(api, org, user);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/en/app/users", "Users");

	const row = userRow(page, user.email);
	await expect(row).toBeVisible();

	// The row menu of the organisation users list acts on the membership;
	// deleting the account is an instance action on Instance > Users.
	await row
		.getByRole("button", {
			name: "Open menu",
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: "Remove from organisation",
		})
		.click();
	await page
		.getByRole("button", {
			name: "Remove",
			exact: true,
		})
		.click();

	// The confirmation is modal, so the row behind it is hidden from the
	// accessibility tree until the dialog goes.
	await expect(page.getByRole("alertdialog")).toHaveCount(0);
	await expect(row).toHaveCount(0);

	// The account survives the removal; only the membership is gone, so the
	// user drops out of the organisation's list and out of `user.find`.
	await expectDenied(
		api.as("admin").user.find({
			id: user.id,
		}),
	);
});

test("users: a removed user loses the organisation it was signed in to", async ({
	api,
	browser,
	org,
}) => {
	const user = await createThrowawayUser(baseURL(), "evicted");
	await addMember(api, org, user);
	await createApiClient(
		baseURL(),
		user.session.cookieHeader,
	).user.setActiveOrganization({
		organizationId: org.id,
	});

	const { context, page } = await pageForSession(browser, user.session);

	try {
		await enterApp(page, org.slug);
		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toBeVisible();

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

		await page.goto("/en/app");
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveURL(/\/en\/select-organization/);
	} finally {
		await context.close();
	}
});

test("users: an admin deletes a user's account", async ({ api, org }) => {
	const user = await createThrowawayUser(baseURL(), "deleted");
	await addMember(api, org, user);

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
		api.as("admin").user.find({
			id: user.id,
		}),
	);
});

test("users: an account that still owns content is not deleted halfway", async ({
	api,
	org,
}) => {
	const user = await createThrowawayUser(baseURL(), "owner");
	await addMember(api, org, user);

	// A throwaway user is created without an organisation, and creating a
	// block is an organisation action, so the session gets one first.
	const client = createApiClient(baseURL(), user.session.cookieHeader);
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});

	// Creating a block leaves `resource_scope.assigned_by` and
	// `resource_visibility.updated_by` pointing at the account, and neither
	// cascades, so the account cannot go until that content is handed over.
	await untilAllowed(() =>
		client.block.create({
			type: "template",
			name: `E2E Users Owned ${user.id}`,
			status: "ready",
			config: {
				systemPrompt: "Created by the users slice.",
			},
		}),
	);

	const refused = await rejection(
		api.asWellKnownAdmin().user.delete({
			userIds: [
				user.id,
			],
		}),
	);
	expect(refused.code).toBe("CONFLICT");
	expect(refused.message).toContain("cannot be deleted yet");

	// The refusal leaves nothing half done: the membership and the account are
	// both still there.
	const listed = await api.as("admin").user.list({
		pageIndex: 0,
		pageSize: 100,
	});
	expect(listed.data.map((entry) => entry.email)).toContain(user.email);

	const found = await api.as("admin").user.find({
		id: user.id,
	});
	expect(found.data.id).toBe(user.id);
});

test("users: a removed user loses the access its groups and grants gave it", async ({
	api,
	org,
}) => {
	test.slow();

	const user = await createThrowawayUser(baseURL(), "detached");
	await addMember(api, org, user);
	const client = createApiClient(baseURL(), user.session.cookieHeader);

	// A group both the granting admin and the target belong to: sharing with a
	// group is only offered for the groups the caller is in.
	const group = await untilAllowed(() =>
		api.as("admin").group.create({
			name: `E2E Users Detach ${user.id}`,
		}),
	);
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId: group.data.id,
			userIds: [
				org.users.admin.id,
				user.id,
			],
		}),
	);

	const block = (name: string) => ({
		type: "template" as const,
		name,
		status: "ready" as const,
		config: {
			systemPrompt: "Created by the users slice.",
		},
	});

	const throughGroup = await untilAllowed(() =>
		api.as("admin").block.create(block(`E2E Users Group Block ${user.id}`)),
	);
	const throughGrant = await untilAllowed(() =>
		api.as("admin").block.create(block(`E2E Users Grant Block ${user.id}`)),
	);

	await untilAllowed(() =>
		api.as("admin").resource.grant({
			resourceType: "block",
			resourceId: throughGroup.data.id,
			principalType: "group",
			principalId: group.data.id,
			role: "viewer",
		}),
	);
	await untilAllowed(() =>
		api.as("admin").resource.grant({
			resourceType: "block",
			resourceId: throughGrant.data.id,
			principalType: "user",
			principalId: user.id,
			role: "viewer",
		}),
	);

	// Both blocks are private, so reaching them is the group membership and
	// the direct grant, nothing else.
	await untilAllowed(() =>
		client.block.find({
			id: throughGroup.data.id,
		}),
	);
	await untilAllowed(() =>
		client.block.find({
			id: throughGrant.data.id,
		}),
	);

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

	// Snapshot lag: the SpiceDB tuples of the removed membership take a moment to go.
	await expect(async () => {
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
	}).toPass({
		timeout: 20_000,
	});

	const grants = await untilAllowed(() =>
		api.as("admin").resource.listGrants({
			resourceType: "block",
			resourceId: throughGrant.data.id,
		}),
	);
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(user.id),
	);
});
