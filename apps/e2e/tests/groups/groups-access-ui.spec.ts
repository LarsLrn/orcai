import { groupsName, templateBlock } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";

test("groups: the access manager shows the group grant on the block page", async ({
	api,
	org,
	pageAs,
}) => {
	const groupName = groupsName("Access Manager");
	const created = await api.as("admin").group.create({
		name: groupName,
	});

	// A member shares with the groups they belong to, and the block's owner is
	// the one who grants here.
	await api.as("admin").group.addMembers({
		groupId: created.data.id,
		userIds: [
			org.users.member.id,
		],
	});

	const blockName = groupsName("Access Manager Block");
	const block = await api.as("member").block.create(templateBlock(blockName));

	await api.as("member").resource.grant({
		resourceType: "block",
		resourceId: block.data.id,
		principals: [
			{
				principalType: "group",
				principalId: created.data.id,
			},
		],
		role: "viewer",
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);

	const accessItem = page.getByRole("menuitem", {
		name: "Access & Groups",
	});

	await open(page, `/en/app/hub/blocks/${block.data.id}`);
	await expect(
		page.getByRole("heading", {
			name: blockName,
		}),
	).toBeVisible();

	// The menu button opens the menu once the page has hydrated.
	await expect(async () => {
		await page
			.getByRole("button", {
				name: "More options",
			})
			.click();
		await expect(accessItem).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	await accessItem.click();

	await expect(
		page.getByRole("heading", {
			name: "Manage Access",
		}),
	).toBeVisible();

	// The grant list names the group and where the grant comes from.
	await expect(page.getByText(groupName).first()).toBeVisible();
	await expect(
		page.getByText("Direct group", {
			exact: true,
		}),
	).toBeVisible();

	// The dialog body scrolls, so the revoke button of the grant row is
	// reachable inside the 1280x720 viewport of the shared Playwright config.
	await page
		.getByRole("button", {
			name: "Revoke access",
			exact: true,
		})
		.click();

	// Revoking asks first. The row button and the confirmation heading carry
	// the same words, so both locators name their role.
	await expect(
		page.getByRole("heading", {
			name: "Revoke access",
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "Revoke",
			exact: true,
		})
		.click();

	await expect(page.getByText("Access revoked")).toBeVisible();

	await expect(
		page.getByText("Direct group", {
			exact: true,
		}),
	).toBeHidden();
	await expect(page.getByText("No direct grants found.")).toBeVisible();

	// The API agrees the grant is gone, and not merely out of the list.
	const grants = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId: block.data.id,
	});
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(created.data.id),
	);

	await api.as("admin").group.delete({
		refs: [
			{
				id: created.data.id,
			},
		],
	});
});

test("groups: the access manager grants several people at once", async ({
	api,
	org,
	pageAs,
}) => {
	const blockName = groupsName("Batch Grant Block");
	const block = await api.as("member").block.create(templateBlock(blockName));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/en/app/hub/blocks/${block.data.id}`);
	await expect(
		page.getByRole("heading", {
			name: blockName,
		}),
	).toBeVisible();

	const accessItem = page.getByRole("menuitem", {
		name: "Access & Groups",
	});

	// The menu button opens the menu once the page has hydrated.
	await expect(async () => {
		await page
			.getByRole("button", {
				name: "More options",
			})
			.click();
		await expect(accessItem).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 25_000,
	});
	await accessItem.click();

	await expect(
		page.getByRole("heading", {
			name: "Manage Access",
		}),
	).toBeVisible();

	// People, not groups: the tab carries the picker this test is about.
	await page
		.getByRole("tab", {
			name: "People",
		})
		.click();

	// A member cannot see emails, so the rows carry the seeded names. No grants
	// exist yet, so each name appears only in the picker.
	const admin = page.getByText("E2E admin", {
		exact: true,
	});
	const manager = page.getByText("E2E manager", {
		exact: true,
	});
	await expect(admin).toBeVisible();
	await expect(manager).toBeVisible();

	await admin.click();
	await manager.click();
	await expect(page.getByText("2 selected")).toBeVisible();

	await page
		.getByRole("button", {
			name: "Grant access",
		})
		.click();

	await expect(page.getByText("Access updated")).toBeVisible();

	// Both land from the one call. The names now belong to the grant rows, so
	// the source badges are what says two direct grants arrived, and an empty
	// selection says the picker no longer offers them.
	await expect(
		page.getByText("Direct user", {
			exact: true,
		}),
	).toHaveCount(2);
	await expect(page.getByText("0 selected")).toBeVisible();

	const grants = await api.as("member").resource.listGrants({
		resourceType: "block",
		resourceId: block.data.id,
	});
	const granted = grants.data.map((grant) => String(grant.principalId));
	expect(granted).toContain(String(org.users.admin.id));
	expect(granted).toContain(String(org.users.manager.id));
});
