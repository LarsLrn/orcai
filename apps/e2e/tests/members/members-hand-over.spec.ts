import type { Locator } from "@playwright/test";
import { createApiClient } from "../../fixtures/api";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import {
	addMember,
	adoptZedToken,
	behaviourInput,
	createThrowawayUser,
	memberRow,
	reachPage,
} from "../../fixtures/members/members";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

/** Swap the preselected receiver for the member with `email`. */
const chooseReceiver = async (dialog: Locator, email: string) => {
	await dialog
		.getByRole("button", {
			name: message("ownership_receiver_change_button"),
		})
		.click();
	await dialog
		.getByRole("textbox", {
			name: message("ownership_receiver_search_placeholder"),
		})
		.fill(email);
	await dialog
		.getByRole("button")
		.filter({
			hasText: email,
		})
		.click();
	await expect(dialog.getByText(email)).toBeVisible();
};

test("members: removing a member hands their block to the member chosen", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "handing");
	await addMember(api, org, user, "member", zedTokens);
	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});
	const name = `E2E Handed Block ${user.id}`;
	const { data: block } = await client.block.create(behaviourInput(name));

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await reachPage(page, "/app/members", message("members_page_title"));
	await memberRow(page, user.email)
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("members_remove_from_organisation_action"),
		})
		.click();

	// The acting admin receives by default, and any eligible member can instead.
	const dialog = page.getByRole("alertdialog");
	await expect(
		dialog.getByText(
			message("ownership_receiver_description", {
				content: "1 block",
			}),
		),
	).toBeVisible();
	await expect(dialog.getByText(org.users.admin.email)).toBeVisible();
	await chooseReceiver(dialog, org.users.manager.email);
	await dialog
		.getByRole("button", {
			name: message("common_remove_button"),
			exact: true,
		})
		.click();
	await expect(dialog).toHaveCount(0);
	await expect(memberRow(page, user.email)).toHaveCount(0);

	await adoptZedToken(page, zedTokens);
	const found = await api.as("manager").block.find({
		id: block.id,
	});
	expect(found.data.userId).toBe(org.users.manager.id);

	const receiverPage = await pageAs("manager");
	await enterApp(receiverPage, org.slug);
	await open(receiverPage, "/app/library/behaviours");
	await expect(
		receiverPage.getByRole("link", {
			name,
			exact: true,
		}),
	).toBeVisible();
});

test("members: deleting an account in the instance hands its content to the organisation's admin", async ({
	api,
	org,
	pageAsWellKnownAdmin,
	zedTokens,
}) => {
	const user = await createThrowawayUser(baseURL(), "leaving");
	await addMember(api, org, user, "member", zedTokens);
	const client = createApiClient(
		baseURL(),
		user.session.cookieHeader,
		zedTokens,
	);
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});
	const { data: block } = await client.block.create(
		behaviourInput(`E2E Deleted Owner ${user.id}`),
	);
	const [owned] = (
		await api.asWellKnownAdmin().instance.ownedContent({
			userIds: [
				user.id,
			],
		})
	).data;
	const receiver = owned?.defaultReceiver;
	if (!receiver) throw new Error("The organisation has no admin to receive.");

	const page = await pageAsWellKnownAdmin();
	await open(page, "/instance/users");
	await memberRow(page, user.email)
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("instance_users_table_delete_menu_item"),
		})
		.click();

	// One row per organisation where the account owns something.
	const dialog = page.getByRole("alertdialog");
	await expect(
		dialog.getByText(org.name, {
			exact: true,
		}),
	).toBeVisible();
	await expect(dialog.getByText(receiver.email)).toBeVisible();
	await dialog
		.getByRole("button", {
			name: message("common_delete_button"),
			exact: true,
		})
		.click();
	await expect(dialog).toHaveCount(0);
	await expect(memberRow(page, user.email)).toHaveCount(0);

	await adoptZedToken(page, zedTokens);
	const found = await api.asWellKnownAdmin().block.find({
		id: block.id,
	});
	expect(found.data.userId).toBe(receiver.id);
});

test("members: the owner hands a bot over and keeps Can manage", async ({
	api,
	org,
	pageAs,
	zedTokens,
}) => {
	const name = `E2E Handed Bot ${Date.now()}`;
	const { data: bot } = await api.as("member").bot.save({
		name,
		description: "Created by the members slice.",
		status: "ready",
		behaviourId: null,
		repositoryIds: [],
	});

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await open(page, `/app/library/bots/${bot.id}`);
	await page
		.getByRole("button", {
			name: message("common_more_actions"),
		})
		.click();
	await page
		.getByRole("menuitem", {
			name: message("ownership_hand_over_action"),
		})
		.click();

	const dialog = page.getByRole("dialog", {
		name: message("ownership_hand_over_title", {
			name,
		}),
	});
	await dialog
		.getByRole("textbox", {
			name: message("ownership_receiver_search_placeholder"),
		})
		.fill(org.users.manager.email);
	await dialog
		.getByRole("button")
		.filter({
			hasText: org.users.manager.email,
		})
		.click();
	await dialog
		.getByRole("button", {
			name: message("ownership_hand_over_action"),
			exact: true,
		})
		.click();
	await expect(dialog).toHaveCount(0);

	await adoptZedToken(page, zedTokens);
	const asReceiver = await api.as("manager").bot.find({
		id: bot.id,
	});
	expect(asReceiver.data.userId).toBe(org.users.manager.id);
	// The previous owner keeps Can manage, so it still manages access.
	const asPrevious = await api.as("member").bot.find({
		id: bot.id,
	});
	expect(asPrevious.data.capabilities.manage_access).toBe(true);
});
