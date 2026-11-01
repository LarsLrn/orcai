import type { ChatId } from "@orcai/core";
import type { Page } from "@playwright/test";
import { adoptPageZedToken } from "../../fixtures/authz/resources";
import {
	composer,
	messageText,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { INFERENCE_MOCK_MODELS } from "../../fixtures/inference/server";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";
import { runId } from "../../fixtures/organisation";

const organizationCard = (page: Page) =>
	page.getByRole("complementary", {
		name: message("organization_profile_active_badge"),
	});

test("home: the organisation card counts what the organisation lists and leads to its page and settings", async ({
	api,
	orgs,
	pageAs,
}) => {
	test.slow();

	const created = await orgs.create(`E2E Home Dashboard ${runId()}`);
	const admin = api.as("admin", created);
	// The initial tour's modal would cover the dashboard.
	await admin.user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const { data: behaviour } = await admin.block.create({
		type: "behaviour",
		name: `E2E Home Behaviour ${runId()}`,
		status: "ready",
		config: {
			systemPrompt: "Answer like a methods tutor.",
		},
	});
	await admin.resource.setVisibility({
		resourceType: "block",
		resourceId: behaviour.id,
		visibility: "public",
		listBlockIds: [],
	});

	const page = await pageAs("admin", created);
	await enterApp(page, created.slug);
	// A fresh organisation's admin lands on the setup checklist otherwise.
	await open(page, "/app?view=use");

	const card = organizationCard(page);
	await expect(
		card.getByRole("heading", {
			name: created.name,
		}),
	).toBeVisible();
	// Only a listed kind links to the catalogue; the counts have plural variants.
	await expect(card.getByText(/^0 bots$/)).toBeVisible();
	await expect(card.getByText(/^0 repositories$/)).toBeVisible();
	await expect(
		card.getByRole("link", {
			name: /^1 behaviour$/,
		}),
	).toHaveAttribute("href", /\/app\/catalogue\/behaviours\?/);
	await expect(
		page.getByText(message("home_try_empty"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText(message("home_chats_empty"), {
			exact: true,
		}),
	).toBeVisible();

	await card
		.getByRole("link", {
			name: message("organization_profile_edit_link"),
		})
		.click();
	await expect(page).toHaveURL(/\/app\/organization$/);

	await open(page, "/app?view=use");
	await organizationCard(page)
		.getByRole("link", {
			name: message("home_organization_page_action"),
		})
		.click();
	await expect(page).toHaveURL(new RegExp(`/app/organizations/${created.id}$`));

	// A member sees the card without the way into the settings.
	await api.as("member", created).user.setTourState({
		tourId: "initialTour",
		state: "completed",
	});
	const member = await pageAs("member", created);
	await enterApp(member, created.slug);
	await open(member, "/app");
	await expect(
		organizationCard(member).getByRole("link", {
			name: message("home_organization_page_action"),
		}),
	).toBeVisible();
	await expect(
		organizationCard(member).getByRole("link", {
			name: message("organization_profile_edit_link"),
		}),
	).toHaveCount(0);
});

// Home and New chat forward the first message each on their own.
for (const [where, path] of [
	[
		"the dashboard",
		"/app",
	],
	[
		"New chat",
		"/app/chat/new",
	],
] as const) {
	test(`home: a message with an attached file on ${where} starts a chat that sends the file`, async ({
		api,
		inference,
		org,
		pageAs,
		zedTokens,
	}) => {
		await setUpChatModel(api, inference);
		const member = api.as("member");
		for (const tourId of [
			"initialTour",
			"chatTour",
		] as const) {
			await member.user.setTourState({
				tourId,
				state: "completed",
			});
		}
		inference.respondWith({
			text: "Got the notes.",
		});

		const page = await pageAs("member");
		await enterApp(page, org.slug);
		await open(page, path);
		// The starter sends nothing until the default model is selected.
		await expect(
			page.getByRole("button", {
				name: INFERENCE_MOCK_MODELS.chat,
			}),
		).toBeVisible();

		await page
			.locator("form")
			.filter({
				has: composer(page),
			})
			.locator('input[type="file"]')
			.setInputFiles({
				name: "reading-notes.txt",
				mimeType: "text/plain",
				buffer: Buffer.from("Chapter three covers sampling frames."),
			});
		await composer(page).fill("Summarise my notes.");
		await composer(page).press("Enter");

		await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]{36}/);
		const chatId = new URL(page.url()).pathname.split("/").at(-1) as ChatId;
		await expect(messageText(page, "Got the notes.")).toBeVisible();
		// The page created the chat, so the API client reads with the page's token.
		await adoptPageZedToken(page, zedTokens);
		await expect
			.poll(async () => {
				const rows = await member.chatMessage.list({
					chatId,
					limit: 100,
				});
				return rows.data.find((row) => row.role === "user")?.attachments;
			})
			.toMatchObject([
				{
					title: "reading-notes.txt",
					fileType: "text/plain",
				},
			]);
		await expect
			.poll(() =>
				inference.requests.some(
					(request) =>
						request.path === "/v1/chat/completions" &&
						JSON.stringify(request.body).includes(
							"Chapter three covers sampling frames.",
						),
				),
			)
			.toBe(true);
	});
}
