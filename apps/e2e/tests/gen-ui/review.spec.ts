import {
	chatName,
	messageText,
	openChat,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import {
	ask,
	completionBodies,
	createGenUiChat,
	historyToolCalls,
	offeredTools,
	toolResults,
	turnFinished,
} from "../../fixtures/gen-ui/gen-ui";
import { expect, type JsonValue, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp } from "../../fixtures/navigation";

const INTRO = "I checked both references against APA 7.";
const CLOSING = "Fix the flagged entries before you submit.";
const TITLE = "APA 7 reference check";
const HATTIE =
	"Hattie, J. and Timperley, H. (2007). The Power of Feedback. Review of Educational Research, 77(1), 81-112.";
const SHUTE = "Shute, V. J. (2008). Focus on formative feedback.";
const GENERAL_NOTE = "Order the entries by first author's surname.";

const REVIEW: JsonValue = {
	title: TITLE,
	items: [
		{
			label: "Hattie & Timperley (2007)",
			text: HATTIE,
			revised:
				"Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, *77*(1), 81–112.",
			findings: [
				{
					label: "Title",
					severity: "error",
					note: "Article titles are in sentence case.",
					excerpt: "The Power of Feedback",
				},
				{
					label: "Authors",
					severity: "error",
					note: "Use a comma and an ampersand.",
					excerpt: "Hattie, J. and Timperley, H.",
				},
			],
		},
		{
			label: "Shute (2008)",
			text: SHUTE,
			findings: [
				{
					label: "Source",
					severity: "warning",
					note: "The journal is missing.",
				},
			],
		},
	],
	general: [
		{
			label: "Reference list order",
			severity: "error",
			note: GENERAL_NOTE,
		},
	],
};

test("gen-ui: a review renders findings, changes and revisions", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createGenUiChat(member, model, chatName("Review"));

	const page = await pageAs("member");
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	inference.script(
		{
			text: INTRO,
			toolCalls: [
				{
					name: "showReview",
					input: REVIEW,
				},
			],
		},
		{
			text: CLOSING,
		},
	);
	await ask(page, "Check my references");
	await turnFinished(page);

	const log = page.getByRole("log");
	const title = log.getByText(TITLE, {
		exact: true,
	});
	// A union matches in document order, which the log's scrolling cannot change.
	await expect(
		messageText(page, INTRO).or(title).or(messageText(page, CLOSING)),
	).toHaveText([
		INTRO,
		TITLE,
		CLOSING,
	]);

	// Footnotes follow the excerpts' order in the text, not the findings'.
	const marks = log.locator("mark");
	await expect(marks).toHaveText([
		"Hattie, J. and Timperley, H.1",
		"The Power of Feedback2",
	]);
	// The item's own row contains its findings, so leave it out by its label.
	const finding = (label: string) =>
		log.getByRole("listitem").filter({
			hasText: label,
			hasNotText: "Hattie & Timperley (2007)",
		});
	await expect(finding("Authors").locator("sup")).toHaveText("1");
	await expect(finding("Title").locator("sup")).toHaveText("2");
	await expect(
		log.getByText(message("gen_ui_review_overall"), {
			exact: true,
		}),
	).toBeVisible();
	await expect(log.getByText(GENERAL_NOTE)).toBeVisible();

	const view = (key: string) =>
		log.getByRole("button", {
			name: message(key),
			exact: true,
		});

	await view("gen_ui_review_view_changes").click();
	await expect(
		log.getByRole("deletion").filter({
			hasText: /^and$/,
		}),
	).toHaveCount(1);
	await expect(
		log.getByRole("insertion").filter({
			hasText: /^&$/,
		}),
	).toHaveCount(1);
	await expect(log.getByText(SHUTE)).toBeVisible();
	await expect(marks).toHaveCount(0);

	await view("gen_ui_review_view_revised").click();
	await expect(
		log.getByRole("emphasis").filter({
			hasText: "Review of Educational Research",
		}),
	).toBeVisible();
	await expect(log.getByText(SHUTE)).toBeVisible();
	await expect(
		log.getByRole("button", {
			name: message("gen_ui_review_copy_revision"),
			exact: true,
		}),
	).toHaveCount(2);
	await expect(
		log.getByRole("button", {
			name: message("gen_ui_review_copy_all"),
			exact: true,
		}),
	).toBeVisible();

	await page.reload();
	await expect(title).toBeVisible();
	await expect(marks).toHaveCount(2);
	await expect(messageText(page, CLOSING)).toBeVisible();

	const [first, second] = completionBodies(inference);
	expect(offeredTools(first)).toEqual(
		expect.arrayContaining([
			"showChecklist",
			"showReview",
			"showMatrix",
		]),
	);
	expect(toolResults(second).map(String).join("")).toContain('{"shown":true}');

	await openChat(page, chatId);
	await ask(page, "Thanks");
	await turnFinished(page);
	expect(historyToolCalls(completionBodies(inference).at(-1))).toContain(
		"showReview",
	);
});
