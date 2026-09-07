import { expectDenied, expectForbidden } from "../../fixtures/authorization";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";
import {
	addMember,
	createOrgsUser,
	memberRole,
} from "../../fixtures/orgs/members";
import { openWhenGranted } from "../../fixtures/orgs/navigation";
import {
	chooseRole,
	openRolePicker,
	roleOption,
	rolePicker,
} from "../../fixtures/orgs/roles";

test("orgs: an admin changes a member's role from the member's page", async ({
	api,
	appBaseURL,
	org,
	pageAs,
}) => {
	test.slow();

	const user = await createOrgsUser(appBaseURL, "promoted");
	await addMember(api.as("admin"), {
		organizationId: org.id,
		user,
		role: "member",
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openWhenGranted(page, `/en/app/users/${user.id}/edit`, "Edit User");

	await chooseRole(page, "member", "manager");

	await expect(rolePicker(page, "manager")).toBeVisible();
	await expect
		.poll(
			async () =>
				await memberRole(api.as("admin"), {
					organizationId: org.id,
					userId: user.id,
				}),
			{
				timeout: 15_000,
			},
		)
		.toBe("manager");
});

test("orgs: a manager changes roles but is not offered the admin role", async ({
	api,
	appBaseURL,
	org,
	pageAs,
}) => {
	test.slow();

	const user = await createOrgsUser(appBaseURL, "demoted");
	await addMember(api.as("admin"), {
		organizationId: org.id,
		user,
		role: "member",
	});

	const page = await pageAs("manager");
	await enterApp(page, org.slug);
	await openWhenGranted(page, `/en/app/users/${user.id}/edit`, "Edit User");

	await chooseRole(page, "member", "viewer");

	await expect(rolePicker(page, "viewer")).toBeVisible();
	await expect
		.poll(
			async () =>
				await memberRole(api.as("admin"), {
					organizationId: org.id,
					userId: user.id,
				}),
			{
				timeout: 15_000,
			},
		)
		.toBe("viewer");

	// Handing out an admin role needs `manage_organization`, which a manager
	// does not have, so the picker leaves it out entirely. The role change
	// above invalidates the user query, and a refetch that lands while the
	// picker is open closes it, so the pair of assertions is retried together.
	await expect(async () => {
		await openRolePicker(page, "viewer");
		await expect(roleOption(page, "admin")).toHaveCount(0);
		await expect(roleOption(page, "member")).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	// And the API refuses it as well, so the missing option is not the only
	// thing standing between a manager and an admin.
	await expectForbidden(
		api.as("manager").organizationMember.update({
			organizationId: org.id,
			userId: user.id,
			role: "admin",
		}),
	);
});

test("orgs: an admin removes a member from the organisation", async ({
	api,
	appBaseURL,
	org,
	pageAs,
}) => {
	const user = await createOrgsUser(appBaseURL, "removed");
	await addMember(api.as("admin"), {
		organizationId: org.id,
		user,
		role: "member",
	});

	// There is no remove-from-organisation control in the interface, only a
	// user-wide delete, so the removal itself goes over the API the interface
	// would call.
	const removed = await api.as("admin").organizationMember.delete({
		organizationId: org.id,
		refs: [
			{
				userId: user.id,
			},
		],
	});
	expect(removed.success).toBe(true);

	await expectDenied(
		api.as("admin").organizationMember.find({
			organizationId: org.id,
			userId: user.id,
		}),
	);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);

	// The member page is scoped to the active organisation, so a user that is
	// no longer a member has nothing to show.
	await page.goto(`/en/app/users/${user.id}/edit`);
	await expect(
		page.getByRole("heading", {
			name: "Edit User",
		}),
	).toHaveCount(0);
});
