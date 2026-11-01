import { expectDenied } from "../../fixtures/authorization";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import {
	addMember,
	behaviourInput,
	chooseRole,
	createThrowawayUser,
	reachPage,
} from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

test("members: the edit page shows what an admin may know about a user", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "details");
	await addMember(api, org, user, "member", zedTokens);

	// A block only this test grants, so the table carries a row of its own.
	const blockName = `E2E Users Block ${runId()}`;
	const block = await api.as("admin").block.create(behaviourInput(blockName));
	await api.as("admin").resource.grant({
		resourceType: "block",
		resourceId: block.data.id,
		principals: [
			{
				principalType: "user",
				principalId: user.id,
			},
		],
		role: "viewer",
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(
		page,
		`/app/members/${user.id}/edit`,
		message("members_edit_page_title"),
	);

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
		page.getByText(message("members_edit_details_status_active"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(message("members_verification_not_verified")),
	).toBeVisible();
	const accessRow = page
		.getByRole("region", {
			name: message("members_access_overview_title"),
		})
		.getByRole("row")
		.filter({
			hasText: blockName,
		});
	await expect(
		accessRow.getByRole("link", {
			name: blockName,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText(message("members_access_overview_type_block"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText(message("members_access_overview_origin_direct_user"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		accessRow.getByText(message("access_role_viewer_label"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByRole("button", {
			name: message("orgs_role_member_label"),
			exact: true,
		}),
	).toBeVisible();
});

test("members: the edit page reports a user without resource access", async ({
	api,
	orgs,
	pageAs,
	zedTokens,
}) => {
	// A new organisation grants nothing and owns no resources, so the table is empty.
	const org = await orgs.create("E2E Users No Access");
	const user = await createThrowawayUser(baseURL(), "no-access");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin", org);
	await enterApp(page, org.slug);
	await reachPage(
		page,
		`/app/members/${user.id}/edit`,
		message("members_edit_page_title"),
	);

	const access = page.getByRole("region", {
		name: message("members_access_overview_title"),
	});
	await expect(
		access.getByText(
			message("members_access_overview_empty_state_description"),
		),
	).toBeVisible();
	await expect(access.getByRole("row")).toHaveCount(0);
});

test("members: an admin changes a user's organisation role", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "promoted");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(
		page,
		`/app/members/${user.id}/edit`,
		message("members_edit_page_title"),
	);

	await chooseRole(page, "Member", "Manager");

	await expect(
		page.getByRole("button", {
			name: message("orgs_role_manager_label"),
			exact: true,
		}),
	).toBeVisible();

	const member = await api.as("admin").organizationMember.find({
		userId: user.id,
	});
	expect(member.data.organizationRole).toBe("manager");
});

test("members: a manager may not hand out the admin role", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "not-admin");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await reachPage(
		page,
		`/app/members/${user.id}/edit`,
		message("members_edit_page_title"),
	);

	await page
		.getByRole("button", {
			name: message("orgs_role_member_label"),
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

test("members: a role change is refused for someone who is not a member", async ({
	api,
}) => {
	const outsider = await createThrowawayUser(baseURL(), "outsider");

	// The user exists but belongs to no organisation, so there is no
	// membership of this organisation to change.
	await expectDenied(
		api.as("admin").organizationMember.update({
			userId: outsider.id,
			role: "manager",
		}),
	);
});

test("members: an organisation admin is not offered ban or delete", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "banned");
	await addMember(api, org, user, "member", zedTokens);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(
		page,
		`/app/members/${user.id}/edit`,
		message("members_edit_page_title"),
	);

	// Banning and deleting an account are instance actions, so the edit page of
	// an organisation admin offers neither. The organisation role picker, which
	// is the organisation-scoped control, stays.
	await expect(
		page.getByRole("button", {
			name: message("orgs_role_member_label"),
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
			name: message("members_remove_from_organisation_action"),
		}),
	).toBeVisible();
});
