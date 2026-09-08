import { expectDenied } from "../../fixtures/authorization";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";
import {
	addMember,
	chooseRole,
	createThrowawayUser,
	reachPage,
	templateBlock,
} from "../../fixtures/users/users";

test("users: the edit page shows what an admin may know about a user", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "details");
	await addMember(api, org, user, "member", zedTokens);

	// A block only this test grants, so the card carries a row of its own.
	const blockName = `E2E Users Block ${runId()}`;
	const block = await api.as("admin").block.create(templateBlock(blockName));
	await api.as("admin").resource.grant({
		resourceType: "block",
		resourceId: block.data.id,
		principalType: "user",
		principalId: user.id,
		role: "viewer",
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, `/en/app/users/${user.id}/edit`, "Edit User");

	// The breadcrumb repeats the name and the email, so both are matched
	// exactly against the field the card renders.
	await expect(
		page.getByText(user.name, {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(user.email, {
			exact: true,
		}),
	).toBeVisible();
	/** Name and email are read-only; this page changes the organisation role and
	 * ban state, while account deletion is instance-scoped. */
	await expect(
		page.getByText("Active", {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByText("Not verified")).toBeVisible();
	const accessCard = page.locator('[data-slot="card"]').filter({
		hasText: "Effective Resource Access",
	});
	await expect(accessCard).toBeVisible();
	const accessRow = accessCard
		.locator('[data-slot="card-content"] > div')
		.filter({
			hasText: blockName,
		});
	await expect(
		accessRow.getByRole("link", {
			name: blockName,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText("Block", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText("Direct user", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText("viewer", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Member",
			exact: true,
		}),
	).toBeVisible();
});

test("users: the edit page reports a user without resource access", async ({
	api,
	orgs,
	pageAs,
	zedTokens,
}) => {
	// A new organisation grants nothing and owns no resources, so the card is empty.
	const org = await orgs.create("E2E Users No Access");
	const user = await createThrowawayUser(baseURL(), "no-access");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin", org);
	await enterApp(page, org.slug);
	await reachPage(page, `/en/app/users/${user.id}/edit`, "Edit User");

	const accessCard = page.locator('[data-slot="card"]').filter({
		hasText: "Effective Resource Access",
	});
	await expect(
		accessCard.getByText(
			"No effective resource access entries in this organisation.",
		),
	).toBeVisible();
	await expect(accessCard.locator('[data-slot="card-content"] a')).toHaveCount(
		0,
	);
});

test("users: an admin changes a user's organisation role", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "promoted");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, `/en/app/users/${user.id}/edit`, "Edit User");

	await chooseRole(page, "Member", "Manager");

	await expect(
		page.getByRole("button", {
			name: "Manager",
			exact: true,
		}),
	).toBeVisible();

	const member = await api.as("admin").organizationMember.find({
		organizationId: org.id,
		userId: user.id,
	});
	expect(member.data.role).toBe("manager");
});

test("users: a manager may not hand out the admin role", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "not-admin");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await reachPage(page, `/en/app/users/${user.id}/edit`, "Edit User");

	await page
		.getByRole("button", {
			name: "Member",
			exact: true,
		})
		.click();

	// Handing out an admin role needs `manage_organization`, so the picker a
	// manager sees offers every role below it and no more.
	await expect(
		page.getByRole("option", {
			name: /^Manager/,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("option", {
			name: /^Admin/,
		}),
	).toHaveCount(0);
});

test("users: a role change is refused for someone who is not a member", async ({
	api,
	org,
}) => {
	const outsider = await createThrowawayUser(baseURL(), "outsider");

	// The user exists but belongs to no organisation, so there is no
	// membership of this organisation to change.
	await expectDenied(
		api.as("admin").organizationMember.update({
			organizationId: org.id,
			userId: outsider.id,
			role: "manager",
		}),
	);
});

test("users: an organisation admin is not offered ban or delete", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "banned");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, `/en/app/users/${user.id}/edit`, "Edit User");

	// Banning and deleting an account are instance actions, so the edit page of
	// an organisation admin offers neither. The organisation role picker, which
	// is the organisation-scoped control, stays.
	await expect(
		page.getByRole("button", {
			name: "Member",
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Ban User",
		}),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", {
			name: "Delete User",
		}),
	).toHaveCount(0);
	// What it does offer is the organisation-scoped removal.
	await expect(
		page.getByRole("button", {
			name: "Remove from organisation",
		}),
	).toBeVisible();
});
