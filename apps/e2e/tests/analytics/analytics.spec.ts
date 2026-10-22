import { chatName, sendTurn, setUpChatModel } from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

test("analytics: an admin sees a bot's usage and ratings, a member is led away", async ({
	api,
	inference,
	org,
	pageAs,
	pageAsWellKnownAdmin,
}) => {
	test.slow();
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const template = await member.block.create({
		type: "template",
		name: chatName("Analytics template"),
		status: "ready",
		config: {
			systemPrompt: "Created by the analytics slice.",
		},
	});
	const { data: bot } = await member.bot.save({
		name: chatName("Analytics bot"),
		description: "Created by the analytics slice.",
		status: "ready",
		templateBlockId: template.data.id,
		databaseBlockIds: [],
	});
	const { data: chat } = await member.chat.create({
		title: chatName("Analytics"),
		botId: bot.id,
		config: model,
	});
	await sendTurn({
		client: member,
		inference,
		chatId: chat.id,
		turn: {
			question: "How many tokens is this?",
			reply: "A handful.",
		},
	});
	const { data: messages } = await member.chatMessage.list({
		chatId: chat.id,
		limit: 10,
	});
	const reply = messages.find((entry) => entry.role === "assistant");
	if (!reply) throw new Error("The turn stored no reply");
	await member.chatMessage.rate({
		chatId: chat.id,
		id: reply.id,
		rating: "very_much",
	});

	const page = await pageAs("admin");
	await enterApp(page, org.slug);
	await open(page, "/app/analytics");
	await expect(
		page.getByRole("heading", {
			name: message("analytics_page_title"),
			level: 1,
		}),
	).toBeVisible();

	const bots = page.locator("[data-slot=card]", {
		has: page.getByText(message("analytics_bots_title"), {
			exact: true,
		}),
	});
	await expect(
		bots.getByRole("row").filter({
			hasText: bot.name,
		}),
	).toBeVisible();
	const ratings = page.locator("[data-slot=card]", {
		has: page.getByText(message("analytics_ratings_title"), {
			exact: true,
		}),
	});
	await expect(
		ratings.getByRole("row").filter({
			hasText: bot.name,
		}),
	).toContainText("100");

	await page
		.getByRole("button", {
			name: message("analytics_range_days_option", {
				days: 7,
			}),
		})
		.click();
	await expect(page).toHaveURL(/days=7/);
	await expect(
		bots.getByRole("row").filter({
			hasText: bot.name,
		}),
	).toBeVisible();

	const memberPage = await pageAs("member");
	await enterApp(memberPage, org.slug);
	await open(memberPage, "/app/analytics");
	await expect(memberPage).toHaveURL(/\/app\/?$/);

	const instancePage = await pageAsWellKnownAdmin();
	await open(instancePage, "/instance/analytics");
	await expect(
		instancePage.getByRole("row").filter({
			hasText: org.name,
		}),
	).toBeVisible();
});
