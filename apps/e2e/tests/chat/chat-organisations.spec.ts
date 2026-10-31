import { createApiClient } from "../../fixtures/api";
import { untilAllowed } from "../../fixtures/authorization";
import { skipChatTour } from "../../fixtures/chat/chat";
import { signIn } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { addMember, createOrgsUser } from "../../fixtures/orgs/members";

test("chat: the chat list follows the active organisation, and another organisation's chat is read-only", async ({
	api,
	appBaseURL,
	browser,
	org,
	orgs,
	seedZedToken,
	zedTokens,
}) => {
	test.slow();

	const other = await orgs.create("E2E Chat Second");
	const user = await createOrgsUser(appBaseURL, "chat-two-orgs");
	await addMember(api.as("admin"), {
		user,
		role: "member",
		zedTokens,
	});
	await untilAllowed(() =>
		addMember(api.as("admin", other), {
			user,
			role: "member",
			zedTokens,
		}),
	);

	const session = await signIn(appBaseURL, user);
	const client = createApiClient(appBaseURL, session.cookieHeader, zedTokens);
	await client.user.setActiveOrganization({
		organizationId: org.id,
	});
	const first = await client.chat.create({
		title: "First organisation chat",
	});
	await client.user.setActiveOrganization({
		organizationId: other.id,
	});
	const second = await client.chat.create({
		title: "Second organisation chat",
	});

	const context = await browser.newContext({
		storageState: session.storageState,
		locale: "en",
	});
	try {
		const page = await context.newPage();
		await seedZedToken(page);
		await enterApp(page, other.slug);
		await open(page, "/app/chat");
		const table = page.getByRole("table");
		await expect(
			table.getByRole("link", {
				name: second.data.title ?? "",
			}),
		).toBeVisible();
		await expect(
			table.getByRole("link", {
				name: first.data.title ?? "",
			}),
		).toHaveCount(0);

		await skipChatTour(page);
		await open(page, `/app/chat/${first.data.id}`);
		await expect(
			page.getByText(
				message("chat_read_only_other_organisation_title", {
					organisation: org.name,
				}),
			),
		).toBeVisible();
		await expect(
			page.getByRole("textbox", {
				name: message("chat_composer_aria_label"),
			}),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test("chat: after leaving their only organisation a user reads their chats in the history", async ({
	api,
	appBaseURL,
	browser,
	org,
	seedZedToken,
	zedTokens,
}) => {
	test.slow();

	const user = await createOrgsUser(appBaseURL, "chat-history");
	await addMember(api.as("admin"), {
		user,
		role: "member",
		zedTokens,
	});
	const session = await signIn(appBaseURL, user);
	const client = createApiClient(appBaseURL, session.cookieHeader, zedTokens);
	await untilAllowed(() =>
		client.user.setActiveOrganization({
			organizationId: org.id,
		}),
	);
	const { data: chat } = await client.chat.create({
		title: "Kept after leaving",
	});
	await api.as("admin").organizationMember.delete({
		refs: [
			{
				userId: user.id,
			},
		],
	});

	const context = await browser.newContext({
		storageState: session.storageState,
		locale: "en",
	});
	try {
		const page = await context.newPage();
		await seedZedToken(page);
		await open(page, "/app");
		await expect(page).toHaveURL(/\/select-organization/);
		await page
			.getByRole("link", {
				name: "1 chat from organisations you left",
			})
			.click();

		await expect(page).toHaveURL(/\/history$/);
		await expect(
			page.getByRole("button", {
				name: message("account_data_export_request_button"),
			}),
		).toBeVisible();
		await page
			.getByRole("link", {
				name: chat.title ?? "",
			})
			.click();

		await expect(page).toHaveURL(new RegExp(`/history/${chat.id}$`));
		await expect(
			page.getByText(
				message("chat_read_only_not_member_title", {
					organisation: org.name,
				}),
			),
		).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: message("chat_actions_download_action"),
			}),
		).toBeVisible();
		await expect(
			page.getByRole("textbox", {
				name: message("chat_composer_aria_label"),
			}),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});
