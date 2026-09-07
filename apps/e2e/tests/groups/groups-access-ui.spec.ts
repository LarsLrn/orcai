import { untilAllowed } from "../../fixtures/authorization";
import { groupsName, templateBlock } from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";
import { enterApp, open } from "../../fixtures/navigation";

test("groups: the access manager shows the group grant on the block page", async ({
	api,
	org,
	pageAs,
}) => {
	const groupName = groupsName("Access Manager");
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name: groupName,
		}),
	);

	// A member shares with the groups they belong to, and the block's owner is
	// the one who grants here.
	await untilAllowed(() =>
		api.as("admin").group.addMembers({
			groupId: created.data.id,
			userIds: [
				org.users.member.id,
			],
		}),
	);

	const blockName = groupsName("Access Manager Block");
	const block = await untilAllowed(() =>
		api.as("member").block.create(templateBlock(blockName)),
	);

	await untilAllowed(() =>
		api.as("member").resource.grant({
			resourceType: "block",
			resourceId: block.data.id,
			principalType: "group",
			principalId: created.data.id,
			role: "viewer",
		}),
	);

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/en/app/hub/blocks/${block.data.id}`);
	await expect(
		page.getByRole("heading", {
			name: blockName,
		}),
	).toBeVisible();

	// Snapshot lag: the menu only carries "Access & Groups" once `manage_access` is visible.
	const accessItem = page.getByRole("menuitem", {
		name: "Access & Groups",
	});

	await expect(async () => {
		await open(page, `/en/app/hub/blocks/${block.data.id}`);
		await page
			.getByRole("button", {
				name: "More options",
			})
			.click();
		await expect(accessItem).toBeVisible({
			timeout: 3_000,
		});
	}).toPass({
		timeout: 30_000,
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
	const grants = await untilAllowed(() =>
		api.as("member").resource.listGrants({
			resourceType: "block",
			resourceId: block.data.id,
		}),
	);
	expect(grants.data.map((grant) => String(grant.principalId))).not.toContain(
		String(created.data.id),
	);

	await untilAllowed(() =>
		api.as("admin").group.delete({
			refs: [
				{
					id: created.data.id,
				},
			],
		}),
	);
});
