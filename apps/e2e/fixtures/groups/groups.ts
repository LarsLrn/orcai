import type { AssetId, BlockId, BotId } from "@orcai/core";
import { type Group, userIdSchema } from "@orcai/schema";
import { expect, type Locator, type Page } from "@playwright/test";
import { type ApiClient, createApiClient, type ZedTokenStore } from "../api";
import { signUpInvited } from "../auth";
import { EMAIL_DOMAIN } from "../constants";
import { baseURL } from "../env";
import { message } from "../messages";
import { open } from "../navigation";
import { runId } from "../organisation";

/** A name no other test uses, so the spec can find its own rows. */
export const groupsName = (label: string): string =>
	`E2E Groups ${label} ${runId()}`;

/** A template block, the one grantable resource that needs no model, provider, or worker. */
export const templateBlock = (name: string) => ({
	type: "template" as const,
	name,
	status: "ready" as const,
	config: {
		systemPrompt: "Created by the groups slice.",
	},
});

/**
 * A database block, the kind a bot links as a repository and the only kind
 * that carries assets.
 */
export const databaseBlock = (name: string, assets: AssetId[] = []) => ({
	type: "database" as const,
	name,
	status: "ready" as const,
	assets,
	config: {
		minReferences: 1,
		maxReferences: 5,
		defaultReferences: 3,
	},
});

/** An asset row without an upload: `asset.create` needs no bytes and no worker. */
export const assetRow = (title: string) => ({
	title,
	size: 1024,
	fileType: "txt" as const,
});

/**
 * The inheritance chain the authz schema cascades over: a bot linking a
 * template block and a database block, and an asset inside that database
 * block. `bot.save` writes the `block#bot` relationship that makes
 * `block.read` include `bot->read`.
 */
export const inheritanceChain = async (params: {
	api: ApiClient;
	label: string;
}): Promise<{
	botId: BotId;
	botName: string;
	templateBlockId: BlockId;
	databaseBlockId: BlockId;
	assetId: AssetId;
}> => {
	const template = await params.api.block.create(
		templateBlock(groupsName(`${params.label} Template`)),
	);
	const asset = await params.api.asset.create(
		assetRow(groupsName(`${params.label} Asset`)),
	);
	const database = await params.api.block.create(
		databaseBlock(groupsName(`${params.label} Database`), [
			asset.data.id,
		]),
	);
	const botName = groupsName(`${params.label} Bot`);
	const bot = await params.api.bot.save({
		name: botName,
		description: "Created by the groups slice.",
		status: "draft",
		templateBlockId: template.data.id,
		databaseBlockIds: [
			database.data.id,
		],
	});

	return {
		botId: bot.data.id,
		botName,
		templateBlockId: template.data.id,
		databaseBlockId: database.data.id,
		assetId: asset.data.id,
	};
};

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

/** The entry for an email in the group detail page's "Current members" list. */
export const memberRow = (page: Page, email: string): Locator =>
	page
		.getByRole("region", {
			name: message("groups_member_list_title"),
		})
		.getByRole("listitem")
		.filter({
			has: page.getByText(email, {
				exact: true,
			}),
		});

/** A member of the active organisation of `admin` that belongs to no group. Shares the test's zedToken memory. */
export const outsiderMember = async (params: {
	admin: ApiClient;
	zedTokens?: ZedTokenStore;
}): Promise<{
	client: ApiClient;
	userId: string;
}> => {
	const url = baseURL();
	const session = await signUpInvited({
		baseURL: url,
		admin: params.admin,
		role: "member",
		name: "E2E Groups Outsider",
		email: `e2e-groups-outsider-${runId()}@${EMAIL_DOMAIN}`,
	});

	return {
		client: createApiClient(url, session.cookieHeader, params.zedTokens),
		userId: userIdSchema.parse(session.userId),
	};
};
