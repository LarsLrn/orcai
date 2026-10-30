import type { BlockId, BotId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { expectForbidden } from "../../fixtures/authorization";
import {
	adoptPageZedToken,
	authzName,
	botSave,
	databaseBlock,
	databaseBlockUpdate,
	grantRole,
	grantUser,
	templateBlock,
} from "../../fixtures/authz/resources";
import {
	type Api,
	expect,
	test,
	type WorkerOrganisation,
} from "../../fixtures/index";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const SHARING_STEP = 3;

/** The member's bot linking the member's template and a repository the admin shared with the member as viewer. */
const sharedBot = async (
	api: Api,
	org: WorkerOrganisation,
): Promise<{
	botId: BotId;
	templateId: BlockId;
	templateName: string;
	repositoryId: BlockId;
}> => {
	const member = api.as("member");
	const admin = api.as("admin");
	const templateName = authzName("Offer Template");
	const template = await member.block.create(templateBlock(templateName));
	const repository = await admin.block.create(
		databaseBlock(authzName("Admin Repository")),
	);
	await grantUser(
		admin,
		{
			resourceType: "block",
			resourceId: repository.data.id,
		},
		org.users.member.id,
		"viewer",
	);
	const bot = await member.bot.save(
		botSave({
			name: authzName("Offer Bot"),
			templateBlockId: template.data.id,
			databaseBlockIds: [
				repository.data.id,
			],
		}),
	);

	return {
		botId: bot.data.id,
		templateId: template.data.id,
		templateName,
		repositoryId: repository.data.id,
	};
};

const offerCheckbox = (page: Page) =>
	page.getByRole("checkbox", {
		name: message("access_manager_block_edit_offer_label"),
	});

/** Open the bot's Sharing step and select the manager on the People tab. */
const pickManagerOnSharingStep = async (
	page: Page,
	org: WorkerOrganisation,
	botId: BotId,
): Promise<void> => {
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${botId}/setup?step=${SHARING_STEP}`);

	await page
		.getByRole("tab", {
			name: message("access_manager_tab_people"),
		})
		.click();
	await page
		.getByText("E2E manager", {
			exact: true,
		})
		.click();
	await expect(
		page.getByText(
			message("common_selected_count", {
				count: 1,
			}),
		),
	).toBeVisible();
};

const ROLE_LABELS = [
	message("access_role_viewer_label"),
	message("access_role_editor_label"),
	message("access_role_manager_label"),
];

/** Choose a role in the grant form's role picker. */
const pickRole = async (page: Page, label: string): Promise<void> => {
	const picker = page.getByRole("combobox").filter({
		hasText: new RegExp(ROLE_LABELS.join("|")),
	});

	await picker.click();
	await page
		.getByRole("option", {
			name: new RegExp(`^${label}`),
		})
		.click();
	await expect(picker).toContainText(label);
};

/** Grant, then wait until the form clears its selection, which follows the block grants. */
const grant = async (page: Page): Promise<void> => {
	await page
		.getByRole("button", {
			name: message("access_manager_grant_action"),
		})
		.click();
	await expect(
		page.getByText(message("access_grant_toast_success")).first(),
	).toBeVisible();
	await expect(
		page.getByText(
			message("common_selected_count", {
				count: 0,
			}),
		),
	).toBeVisible();
};

test("authz: sharing a bot as editor gives edit on the blocks the sharer can share", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	test.slow();

	const shared = await sharedBot(api, org);
	const page = await pageAs("member");
	await pickManagerOnSharingStep(page, org, shared.botId);
	await pickRole(page, message("access_role_editor_label"));

	await expect(offerCheckbox(page)).toBeChecked();
	await expect(
		page.getByText(
			message("access_manager_block_edit_offer_covers", {
				names: shared.templateName,
			}),
			{
				exact: true,
			},
		),
	).toBeVisible();
	await expect(
		page.getByText(message("access_manager_block_edit_offer_unmanaged")),
	).toBeVisible();

	await grant(page);
	await adoptPageZedToken(page, zedTokens);

	const manager = api.as("manager");
	const renamed = await manager.block.update({
		id: shared.templateId,
		...templateBlock(authzName("Offer Template Renamed")),
	});
	expect(renamed.data.id).toBe(shared.templateId);
	await expectForbidden(
		manager.block.update(
			databaseBlockUpdate(
				shared.repositoryId,
				authzName("Admin Repository Renamed"),
				[],
			),
		),
	);

	expect(
		await grantRole(
			api.as("member"),
			{
				resourceType: "block",
				resourceId: shared.templateId,
			},
			org.users.manager.id,
		),
	).toBe("editor");
	expect(
		await grantRole(
			api.as("admin"),
			{
				resourceType: "block",
				resourceId: shared.repositoryId,
			},
			org.users.manager.id,
		),
	).toBeUndefined();
});

test("authz: sharing a bot without the offer, or as viewer, grants nothing on its blocks", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	test.slow();

	const shared = await sharedBot(api, org);
	const page = await pageAs("member");
	await pickManagerOnSharingStep(page, org, shared.botId);

	await expect(offerCheckbox(page)).toHaveCount(0);

	await pickRole(page, message("access_role_editor_label"));
	await offerCheckbox(page).uncheck();
	await expect(offerCheckbox(page)).not.toBeChecked();

	await grant(page);
	await adoptPageZedToken(page, zedTokens);

	const member = api.as("member");
	expect(
		await grantRole(
			member,
			{
				resourceType: "bot",
				resourceId: shared.botId,
			},
			org.users.manager.id,
		),
	).toBe("editor");
	expect(
		await grantRole(
			member,
			{
				resourceType: "block",
				resourceId: shared.templateId,
			},
			org.users.manager.id,
		),
	).toBeUndefined();
	await expectForbidden(
		api.as("manager").block.update({
			id: shared.templateId,
			...templateBlock(authzName("Offer Template Renamed")),
		}),
	);
});

test("authz: the block edit offer never demotes a block manager", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	test.slow();

	const shared = await sharedBot(api, org);
	const member = api.as("member");
	const template = {
		resourceType: "block" as const,
		resourceId: shared.templateId,
	};
	await grantUser(member, template, org.users.manager.id, "manager");

	const page = await pageAs("member");
	await pickManagerOnSharingStep(page, org, shared.botId);
	await pickRole(page, message("access_role_editor_label"));
	await expect(offerCheckbox(page)).toBeChecked();

	await grant(page);
	await adoptPageZedToken(page, zedTokens);

	expect(
		await grantRole(
			member,
			{
				resourceType: "bot",
				resourceId: shared.botId,
			},
			org.users.manager.id,
		),
	).toBe("editor");
	expect(await grantRole(member, template, org.users.manager.id)).toBe(
		"manager",
	);
});
