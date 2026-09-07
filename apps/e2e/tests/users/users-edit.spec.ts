import { expectDenied, untilAllowed } from "../../fixtures/authorization";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import {
	addMember,
	chooseRole,
	createThrowawayUser,
	reachPage,
} from "../../fixtures/users/users";

test("users: the edit page shows what an admin may know about a user", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "details");
	await addMember(api, org, user);

	// Earlier tests can leave public and All Members grants in this worker's
	// organisation. Read the listed access before the page renders it.
	const access = await untilAllowed(() =>
		api.as("admin").user.listAccess({
			id: user.id,
		}),
	);

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
	await expect(page.getByText("Active")).toBeVisible();
	await expect(page.getByText("Not verified")).toBeVisible();
	const accessCard = page.locator('[data-slot="card"]').filter({
		hasText: "Effective Resource Access",
	});
	await expect(accessCard).toBeVisible();
	await expect(accessCard.locator('[data-slot="card-content"] a')).toHaveCount(
		access.data.length,
	);
	if (access.data.length === 0)
		await expect(
			accessCard.getByText(
				"No effective resource access entries in this organisation.",
			),
		).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: "Member",
			exact: true,
		}),
	).toBeVisible();
});

test("users: an admin changes a user's organisation role", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "promoted");
	await addMember(api, org, user);

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

	const member = await untilAllowed(() =>
		api.as("admin").organizationMember.find({
			organizationId: org.id,
			userId: user.id,
		}),
	);
	expect(member.data.role).toBe("manager");
});

test("users: a manager may not hand out the admin role", async ({
	api,
	org,
	pageAs,
}) => {
	const user = await createThrowawayUser(baseURL(), "not-admin");
	await addMember(api, org, user);

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
}) => {
	const user = await createThrowawayUser(baseURL(), "banned");
	await addMember(api, org, user);

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
