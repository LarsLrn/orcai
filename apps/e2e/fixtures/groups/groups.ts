import type { Group } from "@orcai/schema";
import { expect, type Locator, type Page } from "@playwright/test";
import type { ApiClient } from "../api";
import { message } from "../messages";
import { open } from "../navigation";
import { runId } from "../organisation";

/** A name no other test uses, so the spec can find its own rows. */
export const groupsName = (label: string): string =>
	`E2E Groups ${label} ${runId()}`;

/** A behaviour, the one grantable resource that needs no model, provider, or worker. */
export const behaviourInput = (name: string) => ({
	type: "behaviour" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the groups slice.",
	},
});

/** The ids of a `block.list` page, for containment assertions. */
export const blockIds = async (
	list: Promise<{
		data: {
			id: string;
		}[];
	}>,
): Promise<string[]> => (await list).data.map((block) => block.id);

/** Open a page under `/app/groups` and wait for the element that marks it as rendered. */
export const openGroupsPage = async (
	page: Page,
	path: string,
	visible: Locator,
): Promise<void> => {
	await open(page, path);
	await expect(visible).toBeVisible();
};

/** The list page filtered down to one group name, from page one. */
const filteredList = (page: Page, name: string): string => {
	const url = new URL(page.url());
	url.searchParams.set("query", name);
	url.searchParams.set("pageIndex", "0");

	return url.toString();
};

/** Open the list filtered to one group name and wait for its row. */
export const reachGroupRow = async (
	page: Page,
	name: string,
): Promise<void> => {
	await open(page, filteredList(page, name));
	await expect(
		page.getByRole("link", {
			name,
		}),
	).toBeVisible();
};

/** Create a group through the list page dialog and wait for its row. */
export const createGroupThroughUi = async (
	page: Page,
	name: string,
): Promise<void> => {
	await open(page, filteredList(page, name));

	const dialogTitle = page.getByRole("heading", {
		name: message("groups_create_dialog_title"),
	});

	await page
		.getByRole("button", {
			name: message("groups_list_create_action"),
		})
		.click();
	await expect(dialogTitle).toBeVisible();

	await page.getByLabel(message("common_name_label")).fill(name);
	await page
		.getByRole("button", {
			name: message("common_create_button"),
			exact: true,
		})
		.click();
	await expect(dialogTitle).toBeHidden();

	await reachGroupRow(page, name);
};

/** The organisation's "All Members" group, which every member may read. */
export const systemGroup = async (client: ApiClient): Promise<Group> => {
	const groups = await client.group.list({
		filters: {
			search: "All Members",
		},
		pageIndex: 0,
		pageSize: 100,
	});
	const group = groups.data.find((candidate) => candidate.kind === "system");

	if (!group) {
		throw new Error("The organisation has no system group.");
	}

	return group;
};

/** The row for an email in the group detail page's "Current members" table. */
export const memberRow = (page: Page, email: string): Locator =>
	page
		.getByRole("region", {
			name: message("groups_member_list_title"),
		})
		.getByRole("row")
		.filter({
			has: page.getByText(email, {
				exact: true,
			}),
		});
