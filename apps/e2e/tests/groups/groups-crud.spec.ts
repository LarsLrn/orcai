import { rejection, untilAllowed } from "../../fixtures/authorization";
import {
	createGroupThroughUi,
	groupsName,
	memberRow,
	openGroupsPage,
} from "../../fixtures/groups/groups";
import { expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";

test("groups: an admin creates, renames and deletes a group through the UI", async ({
	api,
	org,
	pageAs,
}) => {
	const name = groupsName("Crud");
	const renamed = `${name} Renamed`;

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGroupsPage(
		page,
		"/en/app/groups",
		page.getByRole("heading", {
			name: "Groups",
		}),
	);

	await createGroupThroughUi(page, name);

	await page
		.getByRole("link", {
			name,
		})
		.click();
	await expect(
		page.getByRole("heading", {
			name,
		}),
	).toBeVisible();
	await expect(
		page.getByText("Custom", {
			exact: true,
		}),
	).toBeVisible();

	const saved = page.getByRole("button", {
		name: "Save",
	});

	await expect(async () => {
		await page.getByLabel("Name").fill(renamed);
		await saved.click();
		await expect(
			page.getByRole("heading", {
				name: renamed,
			}),
		).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	// An empty name is refused by the form itself: the group keeps its name
	// because the save button stays disabled.
	await page.getByLabel("Name").fill("   ");
	await expect(saved).toBeDisabled();
	await page.getByLabel("Name").fill(renamed);

	await page
		.getByRole("button", {
			name: "Delete Group",
		})
		.click();
	await page
		.getByRole("button", {
			name: "Delete",
			exact: true,
		})
		.click();
	await expect(page).toHaveURL(/\/en\/app\/groups(\?|$)/);

	const remaining = await untilAllowed(() =>
		api.as("admin").group.list({
			filters: {
				search: name,
			},
			pageIndex: 0,
			pageSize: 100,
		}),
	);
	expect(remaining.rowCount).toBe(0);
});

test("groups: the create dialog refuses an empty name", async ({
	api,
	org,
	pageAs,
}) => {
	const before = await untilAllowed(() =>
		api.as("admin").group.list({
			pageIndex: 0,
			pageSize: 1,
		}),
	);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGroupsPage(
		page,
		"/en/app/groups",
		page.getByRole("heading", {
			name: "Groups",
		}),
	);

	const dialogTitle = page.getByRole("heading", {
		name: "Create Group",
	});

	await expect(async () => {
		await page
			.getByRole("button", {
				name: "Create Group",
			})
			.click();
		await expect(dialogTitle).toBeVisible({
			timeout: 5_000,
		});
	}).toPass({
		timeout: 25_000,
	});

	const create = page.getByRole("button", {
		name: "Create",
		exact: true,
	});
	await expect(create).toBeDisabled();

	// Whitespace alone is not a name either.
	await page.getByLabel("Name").fill("   ");
	await expect(create).toBeDisabled();

	await page
		.getByRole("button", {
			name: "Cancel",
		})
		.click();

	const after = await untilAllowed(() =>
		api.as("admin").group.list({
			pageIndex: 0,
			pageSize: 1,
		}),
	);
	expect(after.rowCount).toBe(before.rowCount);
});

test("groups: an admin adds and removes members through the UI", async ({
	api,
	org,
	pageAs,
}) => {
	const name = groupsName("Members");
	const created = await untilAllowed(() =>
		api.as("admin").group.create({
			name,
		}),
	);

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGroupsPage(
		page,
		`/en/app/groups/${created.data.id}`,
		page.getByRole("heading", {
			name,
		}),
	);

	const options = [
		org.users.member.email,
		org.users.viewer.email,
	].map((email) =>
		page.getByRole("button").filter({
			hasText: email,
		}),
	);

	// The picker is filled by a client query, so a visible option also means
	// the page has hydrated and a click on it will register.
	for (const option of options) {
		await expect(option).toBeVisible();
		await option.click();
	}

	const addSelected = page.getByRole("button", {
		name: "Add Selected",
	});
	await expect(addSelected).toBeEnabled();
	await addSelected.click();

	for (const email of [
		org.users.member.email,
		org.users.viewer.email,
	]) {
		await expect(memberRow(page, email)).toBeVisible();
	}

	// Both are explicit members, in contrast to the implicit membership of the
	// system group.
	const explicitBadges = page.getByText("Explicit", {
		exact: true,
	});
	await expect(explicitBadges).toHaveCount(2);

	const listed = await untilAllowed(() =>
		api.as("admin").group.listMembers({
			groupId: created.data.id,
			pageIndex: 0,
			pageSize: 100,
		}),
	);
	expect(listed.data.map((member) => member.user.id)).toEqual(
		expect.arrayContaining([
			org.users.member.id,
			org.users.viewer.id,
		]),
	);

	await memberRow(page, org.users.viewer.email)
		.getByRole("button", {
			name: "Remove member",
		})
		.click();
	await page
		.getByRole("button", {
			name: "Remove",
			exact: true,
		})
		.click();

	await expect(explicitBadges).toHaveCount(1);
	await expect(memberRow(page, org.users.member.email)).toBeVisible();

	// A user that is no longer a member is offered for adding again.
	await expect(
		page.getByRole("button").filter({
			hasText: org.users.viewer.email,
		}),
	).toBeVisible();

	const afterRemoval = await untilAllowed(() =>
		api.as("admin").group.listMembers({
			groupId: created.data.id,
			pageIndex: 0,
			pageSize: 100,
		}),
	);
	expect(afterRemoval.data.map((member) => member.user.id)).toEqual([
		org.users.member.id,
	]);

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

test("groups: the system group is immutable in the UI and at the API", async ({
	api,
	org,
	pageAs,
}) => {
	const groups = await untilAllowed(() =>
		api.as("admin").group.list({
			pageIndex: 0,
			pageSize: 100,
		}),
	);
	// Every organisation is created with an "All Members" system group.
	const group = groups.data.find((candidate) => candidate.kind === "system");

	if (!group) {
		throw new Error("The organisation has no system group.");
	}

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await openGroupsPage(
		page,
		`/en/app/groups/${group.id}`,
		page.getByRole("heading", {
			name: group.name,
		}),
	);

	await expect(
		page
			.getByText("System", {
				exact: true,
			})
			.first(),
	).toBeVisible();
	await expect(page.getByLabel("Name")).toBeDisabled();
	await expect(
		page.getByRole("button", {
			name: "Save",
		}),
	).toBeDisabled();
	await expect(
		page.getByRole("button", {
			name: "Delete Group",
		}),
	).toHaveCount(0);

	// Its members come from the organisation, not from explicit rows.
	await expect(
		page
			.getByText("Implicit", {
				exact: true,
			})
			.first(),
	).toBeVisible();

	const rename = await rejection(
		api.as("admin").group.update({
			id: group.id,
			name: groupsName("System Rename"),
		}),
	);
	expect(rename.code).toBe("BAD_REQUEST");
	expect(rename.message).toContain("SYSTEM_GROUP_IMMUTABLE");

	const removal = await rejection(
		api.as("admin").group.delete({
			refs: [
				{
					id: group.id,
				},
			],
		}),
	);
	expect(removal.code).toBe("BAD_REQUEST");
	expect(removal.message).toContain("SYSTEM_GROUP_IMMUTABLE");

	const stillThere = await untilAllowed(() =>
		api.as("admin").group.find({
			id: group.id,
		}),
	);
	expect(stillThere.data.name).toBe(group.name);
	expect(stillThere.data.kind).toBe("system");
});
